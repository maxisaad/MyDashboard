#!/usr/bin/env python3
"""MyDash local server — Strava sync + SQLite storage + HTTP API."""

import os
import sys
import time
import sqlite3
import threading
import logging
import json
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

import requests
from dotenv import load_dotenv

load_dotenv()

# --- Logging ---

logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","msg":"%(message)s"}',
    datefmt='%Y-%m-%dT%H:%M:%S',
)
log = logging.getLogger('mydash')

# --- Config ---

STRAVA_CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
STRAVA_CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "data", "mydash.db"))
API_PORT = int(os.getenv("API_PORT", "8765"))
STRAVA_REDIRECT_URI = os.getenv("STRAVA_REDIRECT_URI", f"http://localhost:{API_PORT}/strava-callback")

if not (STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET):
    log.info("ERROR: Missing STRAVA_CLIENT_ID and/or STRAVA_CLIENT_SECRET in .env")
    sys.exit(1)

# --- Database ---

os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            strava_id INTEGER UNIQUE NOT NULL,
            sport_type TEXT NOT NULL,
            name TEXT NOT NULL,
            start_date TEXT NOT NULL,
            duration INTEGER NOT NULL DEFAULT 0,
            distance REAL NOT NULL DEFAULT 0,
            elevation_gain REAL NOT NULL DEFAULT 0,
            training_load INTEGER,
            hr_avg INTEGER,
            calories INTEGER,
            location_label TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            is_all_day INTEGER NOT NULL DEFAULT 0,
            color TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_activities_start_date ON activities(start_date DESC);
        CREATE INDEX IF NOT EXISTS idx_activities_sport_type ON activities(sport_type);
        CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
    """)
    conn.commit()
    conn.close()


def get_setting(key: str) -> str | None:
    conn = get_db()
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else None


def set_setting(key: str, value: str):
    conn = get_db()
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
        (key, value, value),
    )
    conn.commit()
    conn.close()


# --- Strava Auth ---

def get_strava_auth_url() -> str:
    url = "https://www.strava.com/oauth/authorize"
    params = {
        "client_id": STRAVA_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": STRAVA_REDIRECT_URI,
        "scope": "activity:read_all",
        "approval_prompt": "auto",
    }
    return f"{url}?{'&'.join(f'{k}={v}' for k, v in params.items())}"


def exchange_strava_code(code: str) -> dict:
    resp = requests.post(
        "https://www.strava.com/oauth/token",
        json={
            "client_id": STRAVA_CLIENT_ID,
            "client_secret": STRAVA_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
        },
        timeout=30,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"OAuth exchange failed: {resp.status_code} {resp.text}")
    return resp.json()


def refresh_strava_token() -> str:
    refresh_token = get_setting("strava_refresh_token")
    if not refresh_token:
        raise RuntimeError("No refresh token stored. Connect Strava first.")

    resp = requests.post(
        "https://www.strava.com/oauth/token",
        json={
            "client_id": STRAVA_CLIENT_ID,
            "client_secret": STRAVA_CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        },
        timeout=30,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Token refresh failed: {resp.status_code} {resp.text}")

    data = resp.json()
    expires_at = datetime.fromtimestamp(data["expires_at"], tz=timezone.utc).isoformat()

    set_setting("strava_access_token", data["access_token"])
    set_setting("strava_refresh_token", data["refresh_token"])
    set_setting("strava_token_expires_at", expires_at)

    return data["access_token"]


def get_valid_access_token() -> str:
    access_token = get_setting("strava_access_token")
    expires_at_str = get_setting("strava_token_expires_at")

    if not access_token or not expires_at_str:
        raise RuntimeError("No Strava tokens. Connect Strava first.")

    now = datetime.now(timezone.utc)
    expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))

    if now >= expires_at or (expires_at - now).total_seconds() < 300:
        return refresh_strava_token()

    return access_token


# --- Sync ---

def fetch_activities(access_token: str, after_ts: int | None = None) -> list:
    all_acts = []
    page = 1
    per_page = 200

    while True:
        params = {"per_page": per_page, "page": page}
        if after_ts:
            params["after"] = after_ts

        resp = requests.get(
            "https://www.strava.com/api/v3/athlete/activities",
            headers={"Authorization": f"Bearer {access_token}"},
            params=params,
            timeout=30,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"Failed to fetch activities: {resp.status_code} {resp.text}")

        acts = resp.json()
        if not acts:
            break

        all_acts.extend(acts)
        if len(acts) < per_page:
            break

        page += 1
        time.sleep(0.2)

    return all_acts


def sync():
    now = datetime.now(timezone.utc)
    log.info(f"[{now.isoformat()}] Starting Strava sync")

    access_token = get_setting("strava_access_token")
    if not access_token:
        log.info("No Strava connection. Nothing to sync.")
        return

    access_token = get_valid_access_token()

    last_sync = get_setting("last_sync_at")
    if last_sync:
        after_ts = int(datetime.fromisoformat(last_sync.replace("Z", "+00:00")).timestamp())
    else:
        after_ts = None

    activities = fetch_activities(access_token, after_ts)
    log.info(f"Fetched {len(activities)} activities from Strava")

    conn = get_db()
    inserted = 0

    for act in activities:
        sport_type = act.get("sport_type") or "Run"

        conn.execute(
            """INSERT INTO activities
               (strava_id, sport_type, name, start_date, duration, distance,
                elevation_gain, training_load, hr_avg, calories, location_label, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(strava_id) DO UPDATE SET
                sport_type = excluded.sport_type,
                name = excluded.name,
                start_date = excluded.start_date,
                duration = excluded.duration,
                distance = excluded.distance,
                elevation_gain = excluded.elevation_gain,
                training_load = excluded.training_load,
                hr_avg = excluded.hr_avg,
                calories = excluded.calories,
                location_label = excluded.location_label,
                updated_at = excluded.updated_at""",
            (
                act["id"],
                sport_type,
                act.get("name") or "Untitled",
                act.get("start_date"),
                act.get("moving_time") or act.get("elapsed_time") or 0,
                act.get("distance") or 0,
                act.get("total_elevation_gain") or 0,
                act.get("suffer_score"),
                round(act["average_heartrate"]) if act.get("average_heartrate") else None,
                act.get("calories"),
                act.get("location_city")
                or act.get("location_state")
                or (act.get("timezone", "").split("/")[-1] if act.get("timezone") else "Unknown"),
                now.isoformat(),
            ),
        )
        inserted += 1

    conn.commit()
    conn.close()

    set_setting("last_sync_at", now.isoformat())
    log.info(f"Upserted {inserted} activities. Sync complete.")


sync_lock = threading.Lock()


def trigger_sync_background() -> bool:
    if not sync_lock.acquire(blocking=False):
        return False

    def _run():
        try:
            sync()
        except Exception as e:
            log.info(f"Sync failed: {e}")
        finally:
            sync_lock.release()

    threading.Thread(target=_run, daemon=True).start()
    return True


# --- HTTP API Server ---

FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4173",
]


class APIHandler(BaseHTTPRequestHandler):
    def _cors_headers(self):
        origin = self.headers.get("Origin", "")
        if origin in FRONTEND_ORIGINS or origin.startswith("http://localhost:"):
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json_response(self, status: int, data: dict):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self._cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode("utf-8"))

    def _html_response(self, status: int, html: str):
        self.send_response(status)
        self.send_header("Content-Type", "text/html")
        self._cors_headers()
        self.end_headers()
        self.wfile.write(html.encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == "/api/health":
            self._json_response(200, {"status": "ok"})

        elif path == "/api/activities":
            conn = get_db()
            rows = conn.execute(
                "SELECT * FROM activities ORDER BY start_date DESC"
            ).fetchall()
            conn.close()
            activities = [dict(r) for r in rows]
            self._json_response(200, {"activities": activities})

        elif path == "/api/settings":
            is_connected = bool(get_setting("strava_access_token"))
            self._json_response(200, {
                "connected": is_connected,
                "last_sync_at": get_setting("last_sync_at"),
            })

        elif path == "/api/events":
            conn = get_db()
            rows = conn.execute(
                "SELECT * FROM events ORDER BY start_date ASC"
            ).fetchall()
            conn.close()
            events = [dict(r) for r in rows]
            for e in events:
                e["is_all_day"] = bool(e["is_all_day"])
            self._json_response(200, {"events": events})

        elif path == "/connect-strava":
            auth_url = get_strava_auth_url()
            self._html_response(200, f"""
                <html><body style="background:#121212;color:#ededed;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;">
                <div style="text-align:center;">
                    <h2>Connect to Strava</h2>
                    <a href="{auth_url}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#FC4C02;color:white;border-radius:8px;text-decoration:none;font-weight:bold;">
                        Authorize with Strava
                    </a>
                </div>
                </body></html>
            """)

        elif path == "/strava-callback":
            code = query.get("code", [None])[0]
            error = query.get("error", [None])[0]

            if error:
                self._html_response(400, f"""
                    <html><body style="background:#121212;color:#ef4444;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;">
                    <div style="text-align:center;"><h2>Authorization denied</h2><p>{error}</p></div>
                    </body></html>
                """)
                return

            if not code:
                self._html_response(400, "<html><body style='background:#121212;color:#ef4444;'>No code received</body></html>")
                return

            try:
                token_data = exchange_strava_code(code)
                expires_at = datetime.fromtimestamp(token_data["expires_at"], tz=timezone.utc).isoformat()

                set_setting("strava_access_token", token_data["access_token"])
                set_setting("strava_refresh_token", token_data["refresh_token"])
                set_setting("strava_token_expires_at", expires_at)
                set_setting("strava_athlete_id", str(token_data["athlete"]["id"]))

                self._html_response(200, """
                    <html><body style="background:#121212;color:#a3e635;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;">
                    <div style="text-align:center;">
                        <h2>Connected to Strava!</h2>
                        <p>You can close this tab and return to MyDash.</p>
                        <script>setTimeout(() => window.close(), 3000);</script>
                    </div>
                    </body></html>
                """)
            except Exception as e:
                self._html_response(500, f"""
                    <html><body style="background:#121212;color:#ef4444;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;">
                    <div style="text-align:center;"><h2>Error</h2><p>{e}</p></div>
                    </body></html>
                """)

        else:
            self._json_response(404, {"error": "Not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/sync-now":
            started = trigger_sync_background()
            if not started:
                self._json_response(409, {"status": "busy", "message": "Sync already running"})
                return
            self._json_response(202, {"status": "started"})

        elif path == "/strava/disconnect":
            conn = get_db()
            conn.execute("DELETE FROM settings WHERE key LIKE 'strava_%'")
            conn.commit()
            conn.close()
            self._json_response(200, {"status": "disconnected"})

        elif path == "/api/events":
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}

            conn = get_db()
            cursor = conn.execute(
                """INSERT INTO events (title, start_date, end_date, is_all_day, color, updated_at)
                   VALUES (?, ?, ?, ?, ?, datetime('now'))""",
                (
                    body.get("title", "Untitled"),
                    body.get("start_date"),
                    body.get("end_date"),
                    1 if body.get("is_all_day") else 0,
                    body.get("color"),
                ),
            )
            conn.commit()
            event_id = cursor.lastrowid
            conn.close()
            self._json_response(201, {"id": event_id, "status": "created"})

        else:
            self._json_response(404, {"error": "Not found"})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # DELETE /api/events/:id
        if path.startswith("/api/events/"):
            parts = path.split("/")
            if len(parts) == 4 and parts[3].isdigit():
                event_id = int(parts[3])
                conn = get_db()
                conn.execute("DELETE FROM events WHERE id = ?", (event_id,))
                conn.commit()
                conn.close()
                self._json_response(200, {"status": "deleted"})
                return

        elif path == "/api/data":
            conn = get_db()
            conn.execute("DELETE FROM activities")
            conn.execute("DELETE FROM events")
            conn.execute("DELETE FROM settings")
            conn.commit()
            conn.close()
            self._json_response(200, {"status": "all data deleted"})
            return

        self._json_response(404, {"error": "Not found"})

    def log_message(self, format, *args):
        log.info(f"[API] {args[0]}")


def start_api_server():
    server = HTTPServer(("0.0.0.0", API_PORT), APIHandler)
    log.info(f"[{datetime.now(timezone.utc).isoformat()}] API server listening on http://localhost:{API_PORT}")
    log.info(f"  Connect Strava: http://localhost:{API_PORT}/connect-strava")
    log.info(f"  API:            http://localhost:{API_PORT}/api/activities")
    threading.Thread(target=server.serve_forever, daemon=True).start()


# --- Scheduler ---

def main_loop():
    while True:
        now = datetime.now(timezone.utc)
        target = now.replace(hour=22, minute=30, second=0, microsecond=0)
        if target <= now:
            target += timedelta(days=1)

        sleep_seconds = (target - now).total_seconds()
        log.info(f"[{now.isoformat()}] Next sync at {target.isoformat()} ({int(sleep_seconds)}s)")
        time.sleep(sleep_seconds)

        if not trigger_sync_background():
            log.info("Sync already running, skipping")


# --- Main ---

if __name__ == "__main__":
    init_db()

    mode = os.getenv("SYNC_MODE", "scheduled")

    if mode == "once":
        try:
            sync()
        except Exception as e:
            log.info(f"Sync failed: {e}")
    else:
        start_api_server()
        main_loop()
