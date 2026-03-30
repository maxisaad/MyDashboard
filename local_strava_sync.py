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
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
STRAVA_REDIRECT_URI = os.getenv("STRAVA_REDIRECT_URI", f"{FRONTEND_URL}/strava-callback")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", f"{FRONTEND_URL}/gcal-callback")
GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

STRAVA_ENABLED = bool(STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET)
GOOGLE_ENABLED = bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)

if not STRAVA_ENABLED:
    log.info("WARNING: Strava integration disabled (missing STRAVA_CLIENT_ID/SECRET)")
if not GOOGLE_ENABLED:
    log.info("Google Calendar integration disabled (missing GOOGLE_CLIENT_ID/SECRET)")

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
            elapsed_time INTEGER,
            distance REAL NOT NULL DEFAULT 0,
            elevation_gain REAL NOT NULL DEFAULT 0,
            training_load INTEGER,
            hr_avg INTEGER,
            hr_max INTEGER,
            calories INTEGER,
            average_speed REAL,
            average_watts REAL,
            max_watts REAL,
            kilojoules REAL,
            average_temp REAL,
            start_latlng TEXT,
            end_latlng TEXT,
            polyline TEXT,
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

        CREATE TABLE IF NOT EXISTS ical_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL,
            name TEXT NOT NULL,
            color TEXT NOT NULL DEFAULT '#6366f1',
            last_synced_at TEXT,
            sync_status TEXT DEFAULT 'ok',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS ical_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subscription_id INTEGER NOT NULL REFERENCES ical_subscriptions(id) ON DELETE CASCADE,
            uid TEXT NOT NULL,
            title TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            is_all_day INTEGER NOT NULL DEFAULT 0,
            description TEXT,
            location TEXT,
            color TEXT,
            recurrence_id TEXT,
            UNIQUE(subscription_id, uid)
        );
    """)

    # Migrate: add new columns if they don't exist (for existing databases)
    new_columns = [
        ("activities", "elapsed_time", "INTEGER"),
        ("activities", "hr_max", "INTEGER"),
        ("activities", "average_speed", "REAL"),
        ("activities", "average_watts", "REAL"),
        ("activities", "max_watts", "REAL"),
        ("activities", "kilojoules", "REAL"),
        ("activities", "average_temp", "REAL"),
        ("activities", "start_latlng", "TEXT"),
        ("activities", "end_latlng", "TEXT"),
        ("activities", "polyline", "TEXT"),
        ("activities", "laps", "TEXT"),
    ]
    for table, col, col_type in new_columns:
        try:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
        except Exception:
            pass  # Column already exists

    # Google Calendar migration
    gcal_columns = [
        ("events", "source", "TEXT DEFAULT 'local'"),
        ("events", "gcal_event_id", "TEXT"),
        ("events", "gcal_calendar_id", "TEXT"),
        ("events", "is_favorite", "INTEGER DEFAULT 0"),
    ]
    for table, col, col_type in gcal_columns:
        try:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
        except Exception:
            pass  # Column already exists

    # iCal favorites migration
    ical_fav_columns = [
        ("ical_events", "is_favorite", "INTEGER DEFAULT 0"),
    ]
    for table, col, col_type in ical_fav_columns:
        try:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
        except Exception:
            pass  # Column already exists

    # Unique index for gcal event upsert
    try:
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_events_gcal_id ON events(gcal_event_id) WHERE gcal_event_id IS NOT NULL"
        )
    except Exception:
        pass

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


# --- Reverse Geocoding ---

_geocode_cache: dict[str, str] = {}

def reverse_geocode(latlng_str: str) -> str | None:
    """Convert 'lat,lng' string to city name via Nominatim (OpenStreetMap)."""
    if not latlng_str or "," not in latlng_str:
        return None
    if latlng_str in _geocode_cache:
        return _geocode_cache[latlng_str]

    try:
        lat, lng = latlng_str.split(",")
        resp = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": lat.strip(), "lon": lng.strip(), "format": "json", "zoom": 10},
            headers={"User-Agent": "MyDashboard/1.0"},
            timeout=5,
        )
        if resp.ok:
            data = resp.json()
            addr = data.get("address", {})
            city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("municipality")
            if city:
                _geocode_cache[latlng_str] = city
                return city
    except Exception as e:
        log.warning(f"Reverse geocode failed for {latlng_str}: {e}")
    return None


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


def fetch_laps(access_token: str, strava_id: int) -> list | None:
    """Fetch per-km laps for a single activity."""
    resp = requests.get(
        f"https://www.strava.com/api/v3/activities/{strava_id}/laps",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )
    if resp.status_code == 429:
        retry_after = int(resp.headers.get("Retry-After", 5))
        log.warning(f"Rate limited fetching laps for {strava_id}, waiting {retry_after}s")
        time.sleep(retry_after)
        resp = requests.get(
            f"https://www.strava.com/api/v3/activities/{strava_id}/laps",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30,
        )
    if resp.status_code != 200:
        log.warning(f"Failed to fetch laps for activity {strava_id}: {resp.status_code}")
        return None

    laps_raw = resp.json()
    if not laps_raw:
        return None

    # Keep only the fields we need
    return [
        {
            "lap_index": lap.get("lap_index", i + 1),
            "distance": lap.get("distance", 0),
            "moving_time": lap.get("moving_time", 0),
            "elapsed_time": lap.get("elapsed_time", 0),
            "average_speed": lap.get("average_speed", 0),
            "average_heartrate": round(lap["average_heartrate"]) if lap.get("average_heartrate") else None,
        }
        for i, lap in enumerate(laps_raw)
    ]


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

    # Pre-fetch laps for Run activities BEFORE opening DB connection
    # (avoids locking SQLite during slow API calls + rate limiting)
    # Only fetch for recent activities (last 90 days) to respect rate limits
    laps_cache: dict[int, str] = {}
    recent_cutoff = (now - timedelta(days=90)).isoformat()
    for act in activities:
        sport_type = act.get("sport_type") or "Run"
        if sport_type in ("Run", "TrailRun") and act.get("start_date", "") >= recent_cutoff:
            laps = fetch_laps(access_token, act["id"])
            if laps:
                laps_cache[act["id"]] = json.dumps(laps)
            time.sleep(0.25)  # respect Strava rate limits

    conn = get_db()
    inserted = 0

    for act in activities:
        sport_type = act.get("sport_type") or "Run"

        latlng = act.get("start_latlng")
        start_latlng = f"{latlng[0]},{latlng[1]}" if latlng and len(latlng) == 2 else None
        latlng = act.get("end_latlng")
        end_latlng = f"{latlng[0]},{latlng[1]}" if latlng and len(latlng) == 2 else None
        summary_map = act.get("map") or {}
        polyline = summary_map.get("summary_polyline")

        laps_json = laps_cache.get(act["id"])

        conn.execute(
            """INSERT INTO activities
               (strava_id, sport_type, name, start_date, duration, elapsed_time, distance,
                elevation_gain, training_load, hr_avg, hr_max, calories,
                average_speed, average_watts, max_watts, kilojoules, average_temp,
                start_latlng, end_latlng, polyline, laps, location_label, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(strava_id) DO UPDATE SET
                sport_type = excluded.sport_type,
                name = excluded.name,
                start_date = excluded.start_date,
                duration = excluded.duration,
                elapsed_time = excluded.elapsed_time,
                distance = excluded.distance,
                elevation_gain = excluded.elevation_gain,
                training_load = excluded.training_load,
                hr_avg = excluded.hr_avg,
                hr_max = excluded.hr_max,
                calories = excluded.calories,
                average_speed = excluded.average_speed,
                average_watts = excluded.average_watts,
                max_watts = excluded.max_watts,
                kilojoules = excluded.kilojoules,
                average_temp = excluded.average_temp,
                start_latlng = excluded.start_latlng,
                end_latlng = excluded.end_latlng,
                polyline = excluded.polyline,
                laps = excluded.laps,
                location_label = excluded.location_label,
                updated_at = excluded.updated_at""",
            (
                act["id"],
                sport_type,
                act.get("name") or "Untitled",
                act.get("start_date"),
                act.get("moving_time") or act.get("elapsed_time") or 0,
                act.get("elapsed_time"),
                act.get("distance") or 0,
                act.get("total_elevation_gain") or 0,
                act.get("suffer_score"),
                round(act["average_heartrate"]) if act.get("average_heartrate") else None,
                round(act["max_heartrate"]) if act.get("max_heartrate") else None,
                act.get("calories"),
                act.get("average_speed"),
                act.get("average_watts"),
                act.get("max_watts"),
                act.get("kilojoules"),
                act.get("average_temp"),
                start_latlng,
                end_latlng,
                polyline,
                laps_json,
                act.get("location_city")
                or act.get("location_state")
                or reverse_geocode(start_latlng)
                or act.get("name")
                or sport_type,
                now.isoformat(),
            ),
        )
        inserted += 1

    conn.commit()

    # Backfill: fix activities where location_label is the activity name but GPS coords exist
    # Only geocode activities where Strava didn't provide a city (location_label == name)
    # Cap at 50 per sync to respect Nominatim rate limits (1 req/s)
    if not get_setting("location_backfill_done"):
        bad_rows = conn.execute(
            "SELECT id, start_latlng FROM activities WHERE start_latlng IS NOT NULL AND location_label = name LIMIT 50"
        ).fetchall()
        fixed = 0
        for row in bad_rows:
            city = reverse_geocode(row["start_latlng"])
            if city:
                conn.execute("UPDATE activities SET location_label = ? WHERE id = ?", (city, row["id"]))
                fixed += 1
            time.sleep(1)  # respect Nominatim rate limit
        if fixed:
            conn.commit()
            log.info(f"  Backfilled {fixed} location labels via reverse geocoding.")

        # Check if more work remains
        remaining = conn.execute(
            "SELECT COUNT(*) as cnt FROM activities WHERE start_latlng IS NOT NULL AND location_label = name"
        ).fetchone()["cnt"]
        if remaining == 0:
            set_setting("location_backfill_done", "true")
            log.info("  Location backfill complete.")
        else:
            log.info(f"  {remaining} activities still need geocoding (will continue next sync).")

    conn.close()

    # Set last_sync_at to the most recent activity date we actually fetched,
    # not to "now" — otherwise we skip activities created between syncs.
    if inserted > 0 and activities:
        latest_act_date = max(act.get("start_date", "") for act in activities)
        if latest_act_date:
            set_setting("last_sync_at", latest_act_date)
            log.info(f"Upserted {inserted} activities. last_sync_at → {latest_act_date}")
    elif not last_sync:
        # First sync with no activities — don't leave last_sync_at empty forever
        set_setting("last_sync_at", now.isoformat())
        log.info(f"First sync, no activities found. last_sync_at → {now.isoformat()}")
    else:
        log.info(f"Fetched 0 new activities. last_sync_at unchanged ({last_sync})")


sync_lock = threading.Lock()


# --- Google Calendar Auth ---

GOOGLE_COLOR_MAP = {
    "1": "#a4bdfc",  # Lavender
    "2": "#7ae28c",  # Sage
    "3": "#dbadff",  # Grape
    "4": "#ff887c",  # Flamingo
    "5": "#fbd75b",  # Banana
    "6": "#ffb878",  # Tangerine
    "7": "#46d6db",  # Peacock
    "8": "#e1e1e1",  # Graphite
    "9": "#5484ed",  # Blueberry
    "10": "#51b749",  # Basil
    "11": "#dc2127",  # Tomato
}


def get_gcal_auth_url() -> str:
    """Returns the Google OAuth consent URL."""
    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [GOOGLE_REDIRECT_URI],
            }
        },
        scopes=GOOGLE_SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI,
    )
    auth_url, _state = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true",
    )
    return auth_url


def exchange_gcal_code(code: str) -> dict:
    """Exchanges auth code for access + refresh tokens."""
    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [GOOGLE_REDIRECT_URI],
            }
        },
        scopes=GOOGLE_SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI,
    )
    flow.fetch_token(code=code)
    credentials = flow.credentials

    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=credentials.expiry.timestamp() - datetime.now(timezone.utc).timestamp()) if credentials.expiry else datetime.now(timezone.utc) + timedelta(hours=1))

    return {
        "access_token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "expires_at": credentials.expiry.isoformat() if credentials.expiry else (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
    }


def refresh_gcal_token() -> str:
    """Refreshes the access token using the stored refresh token."""
    refresh_token = get_setting("gcal_refresh_token")
    if not refresh_token:
        raise RuntimeError("No Google refresh token stored. Connect Google Calendar first.")

    resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        },
        timeout=30,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Google token refresh failed: {resp.status_code} {resp.text}")

    data = resp.json()
    expires_in = data.get("expires_in", 3600)
    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()

    set_setting("gcal_access_token", data["access_token"])
    set_setting("gcal_token_expires_at", expires_at)
    # Google may return a new refresh token
    if data.get("refresh_token"):
        set_setting("gcal_refresh_token", data["refresh_token"])

    return data["access_token"]


def get_valid_gcal_access_token() -> str:
    """Returns a valid access token, refreshing if needed."""
    access_token = get_setting("gcal_access_token")
    expires_at_str = get_setting("gcal_token_expires_at")

    if not access_token or not expires_at_str:
        raise RuntimeError("No Google tokens. Connect Google Calendar first.")

    now = datetime.now(timezone.utc)
    try:
        expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
    except Exception:
        expires_at = now

    if now >= expires_at or (expires_at - now).total_seconds() < 300:
        return refresh_gcal_token()

    return access_token


# --- Google Calendar Sync ---

gcal_sync_lock = threading.Lock()


def sync_gcal():
    """
    Fetches events from Google Calendar API and upserts them into SQLite.
    """
    if not GOOGLE_ENABLED:
        log.info("Google Calendar not configured, skipping sync.")
        return

    now = datetime.now(timezone.utc)
    log.info(f"[{now.isoformat()}] Starting Google Calendar sync")

    try:
        access_token = get_valid_gcal_access_token()
    except RuntimeError as e:
        log.info(f"Google Calendar sync skipped: {e}")
        return

    headers = {"Authorization": f"Bearer {access_token}"}
    time_min = (now - timedelta(days=7)).isoformat() + "Z"
    time_max = (now + timedelta(days=90)).isoformat() + "Z"

    # Fetch all calendars
    calendars = []
    page_token = None
    while True:
        params = {"pageToken": page_token} if page_token else {}
        resp = requests.get(
            "https://www.googleapis.com/calendar/v3/users/me/calendarList",
            headers=headers,
            params=params,
            timeout=30,
        )
        if resp.status_code == 429:
            time.sleep(2)
            continue
        if resp.status_code != 200:
            log.error(f"Failed to fetch calendar list: {resp.status_code} {resp.text}")
            return
        data = resp.json()
        calendars.extend(data.get("items", []))
        page_token = data.get("nextPageToken")
        if not page_token:
            break

    log.info(f"Found {len(calendars)} calendars")

    conn = get_db()
    gcal_event_ids = set()
    upserted = 0

    for cal in calendars:
        cal_id = cal["id"]
        cal_bg = cal.get("backgroundColor", "#4285f4")
        page_token = None

        while True:
            params = {
                "timeMin": time_min,
                "timeMax": time_max,
                "singleEvents": "true",
                "orderBy": "startTime",
                "maxResults": 250,
            }
            if page_token:
                params["pageToken"] = page_token

            resp = requests.get(
                f"https://www.googleapis.com/calendar/v3/calendars/{cal_id}/events",
                headers=headers,
                params=params,
                timeout=30,
            )
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", 2))
                log.warning(f"Rate limited on calendar {cal_id}, waiting {retry_after}s")
                time.sleep(retry_after)
                continue
            if resp.status_code != 200:
                log.error(f"Failed to fetch events for {cal_id}: {resp.status_code}")
                break

            data = resp.json()
            items = data.get("items", [])

            for ev in items:
                if ev.get("status") == "cancelled":
                    continue

                gcal_id = ev["id"]
                gcal_event_ids.add(gcal_id)

                summary = ev.get("summary") or "(No title)"
                start = ev.get("start", {})
                end = ev.get("end", {})

                # Handle all-day vs timed events
                if "date" in start:
                    start_date = start["date"] + "T00:00:00"
                    end_date = end.get("date", start["date"]) + "T00:00:00"
                    is_all_day = 1
                else:
                    start_date = start.get("dateTime", "")
                    end_date = end.get("dateTime", start_date)
                    is_all_day = 0

                # Determine color
                color_id = ev.get("colorId")
                color = GOOGLE_COLOR_MAP.get(str(color_id), cal_bg) if color_id else cal_bg

                conn.execute(
                    """INSERT INTO events (title, start_date, end_date, is_all_day, color, source, gcal_event_id, gcal_calendar_id, updated_at)
                       VALUES (?, ?, ?, ?, ?, 'gcal', ?, ?, ?)
                       ON CONFLICT(gcal_event_id) DO UPDATE SET
                        title = excluded.title,
                        start_date = excluded.start_date,
                        end_date = excluded.end_date,
                        is_all_day = excluded.is_all_day,
                        color = excluded.color,
                        gcal_calendar_id = excluded.gcal_calendar_id,
                        source = 'gcal',
                        updated_at = excluded.updated_at""",
                    (summary, start_date, end_date, is_all_day, color, gcal_id, cal_id, now.isoformat()),
                )
                upserted += 1

            page_token = data.get("nextPageToken")
            if not page_token:
                break

    # Delete events that no longer exist on Google (cancelled or removed)
    if gcal_event_ids:
        placeholders = ",".join("?" * len(gcal_event_ids))
        deleted = conn.execute(
            f"DELETE FROM events WHERE source = 'gcal' AND gcal_event_id NOT IN ({placeholders})",
            list(gcal_event_ids),
        ).rowcount
    else:
        # No events found at all — could mean all were deleted
        deleted = conn.execute("DELETE FROM events WHERE source = 'gcal'").rowcount

    conn.commit()
    conn.close()

    set_setting("gcal_last_sync_at", now.isoformat())
    log.info(f"Google Calendar sync complete: {upserted} upserted, {deleted} deleted")


def trigger_gcal_sync_background() -> bool:
    if not GOOGLE_ENABLED:
        return False
    if not gcal_sync_lock.acquire(blocking=False):
        return False

    def _run():
        try:
            sync_gcal()
        except Exception as e:
            log.error(f"Google Calendar sync failed: {e}")
        finally:
            gcal_sync_lock.release()

    threading.Thread(target=_run, daemon=True).start()
    return True


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


# --- iCal Subscriptions ---

ical_sync_lock = threading.Lock()


def fetch_and_parse_ical(url: str, subscription_id: int, color: str) -> list[dict]:
    """Fetch and parse an iCal feed, returning event dicts ready for DB insert."""
    from icalendar import Calendar
    from dateutil.rrule import rrulestr, DAILY, WEEKLY, MONTHLY, YEARLY
    from dateutil import tz as dateutil_tz

    resp = requests.get(url, timeout=10, headers={"User-Agent": "MyDashboard/1.0"})
    resp.raise_for_status()

    cal = Calendar.from_ical(resp.text)

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=7)
    window_end = now + timedelta(days=90)

    events = []

    for component in cal.walk():
        if component.name != "VEVENT":
            continue

        uid_raw = str(component.get("UID", ""))
        summary = str(component.get("SUMMARY", "(No title)"))
        desc = str(component.get("DESCRIPTION", "")) or None
        location = str(component.get("LOCATION", "")) or None
        dtstart_prop = component.get("DTSTART")
        dtend_prop = component.get("DTEND")
        duration_prop = component.get("DURATION")

        if not dtstart_prop:
            continue

        dtstart = dtstart_prop.dt
        is_all_day = isinstance(dtstart, type(dtstart)) and not isinstance(dtstart, datetime)

        # Determine if date-only or datetime
        start_is_date = not isinstance(dtstart, datetime)

        # Handle timezone
        def to_utc(dt_val):
            if isinstance(dt_val, datetime):
                if dt_val.tzinfo is None:
                    return dt_val.replace(tzinfo=timezone.utc)
                return dt_val.astimezone(timezone.utc)
            # date-only → treat as midnight UTC
            return datetime.combine(dt_val, datetime.min.time()).replace(tzinfo=timezone.utc)

        rrule_raw = component.get("RRULE")

        if rrule_raw:
            # Recurring event — expand with rrule
            # Build rrule string
            from dateutil.rrule import rrulestr
            rrule_str_parts = []
            for key, vals in rrule_raw.items():
                rrule_str_parts.append(f"{key}={','.join(str(v) for v in vals)}")
            rrule_line = "RRULE:" + ";".join(rrule_str_parts)

            dtstart_utc = to_utc(dtstart)
            dtend_utc = to_utc(dtend_prop.dt) if dtend_prop else None

            rule = rrulestr(rrule_line, dtstart=dtstart_utc, ignoretz=True)
            occurrences = rule.between(
                window_start.replace(tzinfo=None),
                window_end.replace(tzinfo=None),
                inc=True
            )

            if dtend_utc and not start_is_date:
                duration_td = dtend_utc - dtstart_utc
            elif duration_prop:
                duration_td = duration_prop.dt if hasattr(duration_prop.dt, 'total_seconds') else timedelta(hours=1)
            elif start_is_date:
                duration_td = timedelta(days=1)
            else:
                duration_td = timedelta(hours=1)

            for occ_start_naive in occurrences:
                occ_start = occ_start_naive.replace(tzinfo=timezone.utc)
                occ_end = occ_start + duration_td
                occ_uid = f"{uid_raw}:{occ_start.strftime('%Y%m%dT%H%M%SZ')}"
                events.append({
                    "subscription_id": subscription_id,
                    "uid": occ_uid,
                    "title": summary,
                    "start_date": occ_start.isoformat(),
                    "end_date": occ_end.isoformat(),
                    "is_all_day": 1 if start_is_date else 0,
                    "description": desc,
                    "location": location,
                    "color": color,
                    "recurrence_id": uid_raw,
                })
        else:
            # Single event
            start_utc = to_utc(dtstart)
            if dtend_prop:
                end_utc = to_utc(dtend_prop.dt)
            elif duration_prop:
                dur = duration_prop.dt
                end_utc = start_utc + dur
            elif start_is_date:
                end_utc = start_utc + timedelta(days=1)
            else:
                end_utc = start_utc + timedelta(hours=1)

            # Check if event is in window
            if end_utc >= window_start and start_utc <= window_end:
                events.append({
                    "subscription_id": subscription_id,
                    "uid": uid_raw,
                    "title": summary,
                    "start_date": start_utc.isoformat(),
                    "end_date": end_utc.isoformat(),
                    "is_all_day": 1 if start_is_date else 0,
                    "description": desc,
                    "location": location,
                    "color": color,
                    "recurrence_id": None,
                })

    return events


def sync_ical_subscription(subscription_id: int):
    """Sync a single iCal subscription — fetch, parse, replace events."""
    conn = get_db()
    row = conn.execute("SELECT * FROM ical_subscriptions WHERE id = ?", (subscription_id,)).fetchone()
    if not row:
        conn.close()
        return

    url = row["url"]
    color = row["color"]
    conn.close()

    try:
        events = fetch_and_parse_ical(url, subscription_id, color)
    except Exception as e:
        log.error(f"iCal sync failed for subscription {subscription_id}: {e}")
        conn = get_db()
        conn.execute(
            "UPDATE ical_subscriptions SET sync_status = 'error' WHERE id = ?",
            (subscription_id,),
        )
        conn.commit()
        conn.close()
        return

    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    # Replace all events for this subscription
    conn.execute("DELETE FROM ical_events WHERE subscription_id = ?", (subscription_id,))

    for ev in events:
        conn.execute(
            """INSERT INTO ical_events (subscription_id, uid, title, start_date, end_date, is_all_day, description, location, color, recurrence_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                ev["subscription_id"], ev["uid"], ev["title"], ev["start_date"],
                ev["end_date"], ev["is_all_day"], ev["description"],
                ev["location"], ev["color"], ev["recurrence_id"],
            ),
        )

    conn.execute(
        "UPDATE ical_subscriptions SET last_synced_at = ?, sync_status = 'ok' WHERE id = ?",
        (now, subscription_id),
    )
    conn.commit()
    conn.close()
    log.info(f"iCal sync complete for subscription {subscription_id}: {len(events)} events")


def sync_all_ical():
    """Sync all iCal subscriptions."""
    conn = get_db()
    rows = conn.execute("SELECT id FROM ical_subscriptions").fetchall()
    conn.close()

    for row in rows:
        sync_ical_subscription(row["id"])


def trigger_ical_sync_background() -> bool:
    if not ical_sync_lock.acquire(blocking=False):
        return False

    def _run():
        try:
            sync_all_ical()
        except Exception as e:
            log.error(f"iCal sync failed: {e}")
        finally:
            ical_sync_lock.release()

    threading.Thread(target=_run, daemon=True).start()
    return True


# --- HTTP API Server ---

FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4173",
    "https://planetaurora.dedyn.io",
]


class APIHandler(BaseHTTPRequestHandler):
    def _cors_headers(self):
        origin = self.headers.get("Origin", "")
        if origin in FRONTEND_ORIGINS or origin.startswith("http://localhost:"):
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
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
            # Local + gcal events
            rows = conn.execute(
                "SELECT * FROM events ORDER BY start_date ASC"
            ).fetchall()
            events = [dict(r) for r in rows]
            for e in events:
                e["is_all_day"] = bool(e["is_all_day"])
                # Normalize field names for frontend compatibility
                e["start"] = e.pop("start_date", e.get("start"))
                e["end"] = e.pop("end_date", e.get("end"))
                e["source"] = e.get("source", "local")
                e["isFavorite"] = bool(e.pop("is_favorite", False))

            # iCal events
            ical_rows = conn.execute(
                """SELECT ie.id, ie.title, ie.start_date, ie.end_date, ie.is_all_day,
                          ie.description, ie.location, ie.color, ie.subscription_id, ie.is_favorite,
                          s.name as subscription_name
                   FROM ical_events ie
                   JOIN ical_subscriptions s ON s.id = ie.subscription_id
                   ORDER BY ie.start_date ASC"""
            ).fetchall()
            for r in ical_rows:
                d = dict(r)
                events.append({
                    "id": f"ical-{d['id']}",
                    "title": d["title"],
                    "start": d["start_date"],
                    "end": d["end_date"],
                    "isAllDay": bool(d["is_all_day"]),
                    "isFavorite": bool(d.get("is_favorite")),
                    "color": d["color"],
                    "source": "ical",
                    "ical_subscription_id": d["subscription_id"],
                    "ical_description": d["description"],
                    "ical_location": d["location"],
                })

            conn.close()
            self._json_response(200, {"events": events})

        elif path == "/connect-gcal":
            if not GOOGLE_ENABLED:
                self._json_response(400, {"error": "Google Calendar not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env"})
                return
            auth_url = get_gcal_auth_url()
            self._json_response(200, {"url": auth_url})

        elif path == "/api/gcal/settings":
            is_connected = bool(get_setting("gcal_access_token"))
            conn = get_db()
            event_count = conn.execute("SELECT COUNT(*) as cnt FROM events WHERE source = 'gcal'").fetchone()["cnt"]
            conn.close()
            self._json_response(200, {
                "connected": is_connected,
                "last_sync_at": get_setting("gcal_last_sync_at"),
                "event_count": event_count,
                "enabled": GOOGLE_ENABLED,
            })

        elif path == "/gcal-callback":
            code = query.get("code", [None])[0]
            error = query.get("error", [None])[0]
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

            if error:
                self.send_response(302)
                self.send_header("Location", f"{frontend_url}?gcal=error&reason={error}")
                self.end_headers()
                return

            if not code:
                self.send_response(302)
                self.send_header("Location", f"{frontend_url}?gcal=error&reason=no_code")
                self.end_headers()
                return

            try:
                token_data = exchange_gcal_code(code)

                set_setting("gcal_access_token", token_data["access_token"])
                set_setting("gcal_refresh_token", token_data["refresh_token"])
                set_setting("gcal_token_expires_at", token_data["expires_at"])

                # Trigger initial sync
                trigger_gcal_sync_background()

                self.send_response(302)
                self.send_header("Location", f"{frontend_url}?gcal=connected")
                self.end_headers()
            except Exception as e:
                log.error(f"Google OAuth exchange failed: {e}")
                self.send_response(302)
                self.send_header("Location", f"{frontend_url}?gcal=error&reason=exchange_failed")
                self.end_headers()

        elif path == "/connect-strava":
            if not STRAVA_ENABLED:
                self._json_response(400, {"error": "Strava not configured. Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in .env"})
                return
            auth_url = get_strava_auth_url()
            self._json_response(200, {"url": auth_url})

        elif path == "/strava-callback":
            code = query.get("code", [None])[0]
            error = query.get("error", [None])[0]
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

            if error:
                self.send_response(302)
                self.send_header("Location", f"{frontend_url}?strava=error&reason={error}")
                self.end_headers()
                return

            if not code:
                self.send_response(302)
                self.send_header("Location", f"{frontend_url}?strava=error&reason=no_code")
                self.end_headers()
                return

            try:
                token_data = exchange_strava_code(code)
                expires_at = datetime.fromtimestamp(token_data["expires_at"], tz=timezone.utc).isoformat()

                set_setting("strava_access_token", token_data["access_token"])
                set_setting("strava_refresh_token", token_data["refresh_token"])
                set_setting("strava_token_expires_at", expires_at)
                set_setting("strava_athlete_id", str(token_data["athlete"]["id"]))

                self.send_response(302)
                self.send_header("Location", f"{frontend_url}?strava=connected")
                self.end_headers()
            except Exception as e:
                log.error(f"OAuth exchange failed: {e}")
                self.send_response(302)
                self.send_header("Location", f"{frontend_url}?strava=error&reason=exchange_failed")
                self.end_headers()

        elif path == "/api/ical/subscriptions":
            conn = get_db()
            rows = conn.execute("SELECT * FROM ical_subscriptions ORDER BY name").fetchall()
            conn.close()
            subs = [dict(r) for r in rows]
            self._json_response(200, {"subscriptions": subs})

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

        elif path == "/gcal/sync-now":
            started = trigger_gcal_sync_background()
            if not started:
                self._json_response(409, {"status": "busy", "message": "Google Calendar sync already running"})
                return
            self._json_response(202, {"status": "started"})

        elif path == "/gcal/disconnect":
            conn = get_db()
            conn.execute("DELETE FROM events WHERE source = 'gcal'")
            conn.execute("DELETE FROM settings WHERE key LIKE 'gcal_%'")
            conn.commit()
            conn.close()
            self._json_response(200, {"status": "disconnected"})

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
                """INSERT INTO events (title, start_date, end_date, is_all_day, color, source, updated_at)
                   VALUES (?, ?, ?, ?, ?, 'local', datetime('now'))""",
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

        elif path == "/api/ical/subscriptions":
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}
            url = body.get("url", "").strip()
            name = body.get("name", "").strip()
            color = body.get("color", "#6366f1").strip()

            if not url or not name:
                self._json_response(400, {"error": "url and name are required"})
                return

            if len(name) > 50:
                self._json_response(400, {"error": "name must be 50 characters or less"})
                return

            # Validate URL by attempting to fetch + parse
            try:
                events = fetch_and_parse_ical(url, 0, color)
            except Exception as e:
                self._json_response(400, {"error": f"Invalid iCal URL or parse error: {e}"})
                return

            conn = get_db()
            cursor = conn.execute(
                "INSERT INTO ical_subscriptions (url, name, color) VALUES (?, ?, ?)",
                (url, name, color),
            )
            sub_id = cursor.lastrowid
            conn.commit()
            conn.close()

            # Sync the new subscription in background
            def _sync_new():
                try:
                    sync_ical_subscription(sub_id)
                except Exception as e:
                    log.error(f"Initial iCal sync failed for {sub_id}: {e}")
            threading.Thread(target=_sync_new, daemon=True).start()

            self._json_response(201, {"id": sub_id, "status": "created", "event_count": len(events)})

        elif path == "/api/ical/sync":
            started = trigger_ical_sync_background()
            if not started:
                self._json_response(409, {"status": "busy", "message": "iCal sync already running"})
                return
            self._json_response(202, {"status": "started"})

        elif path.startswith("/api/ical/subscriptions/") and path.endswith("/sync"):
            parts = path.split("/")
            if len(parts) == 5 and parts[3].isdigit():
                sub_id = int(parts[3])
                def _sync_one():
                    try:
                        sync_ical_subscription(sub_id)
                    except Exception as e:
                        log.error(f"iCal sync for subscription {sub_id} failed: {e}")
                threading.Thread(target=_sync_one, daemon=True).start()
                self._json_response(202, {"status": "started"})
                return

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
            conn.execute("DELETE FROM ical_events")
            conn.execute("DELETE FROM ical_subscriptions")
            conn.commit()
            conn.close()
            self._json_response(200, {"status": "all data deleted"})
            return

        elif path.startswith("/api/ical/subscriptions/"):
            parts = path.split("/")
            if len(parts) == 5 and parts[3].isdigit():
                sub_id = int(parts[3])
                conn = get_db()
                conn.execute("DELETE FROM ical_subscriptions WHERE id = ?", (sub_id,))
                conn.commit()
                conn.close()
                self._json_response(200, {"status": "deleted"})
                return

        self._json_response(404, {"error": "Not found"})

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/ical/subscriptions/"):
            parts = path.split("/")
            if len(parts) == 5 and parts[3].isdigit():
                sub_id = int(parts[3])
                content_length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(content_length)) if content_length else {}

                name = body.get("name")
                color = body.get("color")

                if not name and not color:
                    self._json_response(400, {"error": "name or color required"})
                    return

                conn = get_db()
                updates = []
                params = []
                if name:
                    if len(name) > 50:
                        conn.close()
                        self._json_response(400, {"error": "name must be 50 characters or less"})
                        return
                    updates.append("name = ?")
                    params.append(name)
                if color:
                    updates.append("color = ?")
                    params.append(color)
                params.append(sub_id)
                conn.execute(
                    f"UPDATE ical_subscriptions SET {', '.join(updates)} WHERE id = ?",
                    params,
                )
                conn.commit()
                conn.close()
                self._json_response(200, {"status": "updated"})
                return

        self._json_response(404, {"error": "Not found"})

    def do_PATCH(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # PATCH /api/events/:id/favorite — toggle is_favorite
        if path.startswith("/api/events/") and path.endswith("/favorite"):
            parts = path.split("/")
            if len(parts) == 5 and parts[3].isdigit():
                event_id = int(parts[3])
                content_length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(content_length)) if content_length else {}
                is_fav = 1 if body.get("is_favorite") else 0

                conn = get_db()
                conn.execute("UPDATE events SET is_favorite = ? WHERE id = ?", (is_fav, event_id))
                conn.commit()
                conn.close()
                self._json_response(200, {"status": "updated", "is_favorite": bool(is_fav)})
                return

        # PATCH /api/ical/events/:id/favorite — toggle is_favorite for ical events
        if path.startswith("/api/ical/events/") and path.endswith("/favorite"):
            parts = path.split("/")
            if len(parts) == 5 and parts[3].isdigit():
                event_id = int(parts[3])
                content_length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(content_length)) if content_length else {}
                is_fav = 1 if body.get("is_favorite") else 0

                conn = get_db()
                conn.execute("UPDATE ical_events SET is_favorite = ? WHERE id = ?", (is_fav, event_id))
                conn.commit()
                conn.close()
                self._json_response(200, {"status": "updated", "is_favorite": bool(is_fav)})
                return

        self._json_response(404, {"error": "Not found"})

    def log_message(self, format, *args):
        log.info(f"[API] {args[0]}")


def start_api_server():
    server = HTTPServer(("0.0.0.0", API_PORT), APIHandler)
    log.info(f"[{datetime.now(timezone.utc).isoformat()}] API server listening on http://localhost:{API_PORT}")
    log.info(f"  API:            http://localhost:{API_PORT}/api/activities")
    threading.Thread(target=server.serve_forever, daemon=True).start()


# --- Scheduler ---

# Sync intervals (seconds)
SYNC_INTERVAL = 1800  # 30 minutes

def main_loop():
    strava_last_sync = [0]
    gcal_last_sync = [0]
    ical_last_sync = [0]
    ICAL_SYNC_INTERVAL = 86400  # 24 hours

    while True:
        now = datetime.now(timezone.utc)

        # Strava sync every 30 min (if connected)
        if STRAVA_ENABLED and get_setting("strava_access_token"):
            elapsed = now.timestamp() - strava_last_sync[0]
            if elapsed >= SYNC_INTERVAL:
                strava_last_sync[0] = now.timestamp()  # update before attempting
                if trigger_sync_background():
                    log.info("Triggered scheduled Strava sync")
                else:
                    log.info("Strava sync already running, skipping")

        # Google Calendar sync every 30 min (if connected)
        if GOOGLE_ENABLED and get_setting("gcal_access_token"):
            elapsed = now.timestamp() - gcal_last_sync[0]
            if elapsed >= SYNC_INTERVAL:
                gcal_last_sync[0] = now.timestamp()  # update before attempting
                if trigger_gcal_sync_background():
                    log.info("Triggered scheduled Google Calendar sync")
                else:
                    log.info("Google Calendar sync already running, skipping")

        # iCal sync every 24 hours (if any subscriptions exist)
        elapsed = now.timestamp() - ical_last_sync[0]
        if elapsed >= ICAL_SYNC_INTERVAL:
            conn = get_db()
            has_subs = conn.execute("SELECT COUNT(*) as cnt FROM ical_subscriptions").fetchone()["cnt"]
            conn.close()
            if has_subs > 0:
                ical_last_sync[0] = now.timestamp()
                if trigger_ical_sync_background():
                    log.info("Triggered scheduled iCal sync")
                else:
                    log.info("iCal sync already running, skipping")

        # Sleep 5 min chunks (lightweight, allows responsive shutdown)
        time.sleep(300)


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
        # Trigger initial syncs on startup if tokens exist
        if STRAVA_ENABLED and get_setting("strava_access_token"):
            log.info("Triggering initial Strava sync on startup")
            trigger_sync_background()
        if GOOGLE_ENABLED and get_setting("gcal_access_token"):
            log.info("Triggering initial Google Calendar sync on startup")
            trigger_gcal_sync_background()
        main_loop()
