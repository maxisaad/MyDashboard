import os
import time
import threading
import json
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer

import requests
from dotenv import load_dotenv
from supabase import create_client


load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_USER_ID = os.getenv("SUPABASE_USER_ID")

STRAVA_CLIENT_ID = os.getenv("STRAVA_CLIENT_ID") or os.getenv("VITE_STRAVA_CLIENT_ID")
STRAVA_CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET") or os.getenv("VITE_STRAVA_CLIENT_SECRET")

MANUAL_SYNC_PORT = int(os.getenv("MANUAL_SYNC_PORT", "8765"))

if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and SUPABASE_USER_ID):
    raise RuntimeError("Missing Supabase env vars (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_USER_ID)")

if not (STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET):
    raise RuntimeError("Missing Strava env vars (STRAVA_CLIENT_ID/SECRET or VITE_STRAVA_CLIENT_ID/SECRET)")


supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
sync_lock = threading.Lock()


def iso_to_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def get_user_settings():
    res = (
        supabase.table("user_settings")
        .select("*")
        .eq("user_id", SUPABASE_USER_ID)
        .maybe_single()
        .execute()
    )
    data = res.data
    if not data:
        raise RuntimeError("No user_settings row found for this user. Connect Strava at least once first.")
    return data


def update_user_settings(updates: dict):
    supabase.table("user_settings").update(updates).eq("user_id", SUPABASE_USER_ID).execute()


def refresh_strava_token(settings):
    refresh_token = settings.get("strava_refresh_token")
    if not refresh_token:
        raise RuntimeError("Missing strava_refresh_token in user_settings")

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
        raise RuntimeError(f"Failed to refresh Strava token: {resp.status_code} {resp.text}")

    token_data = resp.json()
    expires_at = datetime.fromtimestamp(token_data["expires_at"], tz=timezone.utc).isoformat()

    update_user_settings(
        {
            "strava_access_token": token_data["access_token"],
            "strava_refresh_token": token_data["refresh_token"],
            "strava_token_expires_at": expires_at,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    return token_data["access_token"]


def get_valid_access_token(settings):
    access_token = settings.get("strava_access_token")
    expires_at_str = settings.get("strava_token_expires_at")

    if not access_token or not expires_at_str:
        raise RuntimeError("Missing Strava access token or expiry in user_settings")

    now = datetime.now(timezone.utc)
    expires_at = iso_to_datetime(expires_at_str)

    if now >= expires_at or (expires_at - now).total_seconds() < 300:
        return refresh_strava_token(settings)

    return access_token


def fetch_activities(access_token: str, after_ts: int | None):
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
    print(f"[{now.isoformat()}] Starting Strava sync")

    settings = get_user_settings()
    if not settings.get("strava_access_token"):
        print("No Strava connection for this user (strava_access_token is null). Nothing to do.")
        return

    access_token = get_valid_access_token(settings)

    last_sync_at = settings.get("last_sync_at")
    if last_sync_at:
        after_ts = int(iso_to_datetime(last_sync_at).timestamp())
    else:
        after_ts = None

    activities = fetch_activities(access_token, after_ts)
    print(f"Fetched {len(activities)} activities from Strava")

    inserted = 0

    for act in activities:
        sport_type = act.get("sport_type") or "Run"

        activity_data = {
            "user_id": SUPABASE_USER_ID,
            "strava_id": act["id"],
            "sport_type": sport_type,
            "name": act.get("name") or "Untitled",
            "start_date": act.get("start_date"),
            "duration": act.get("moving_time") or act.get("elapsed_time") or 0,
            "distance": act.get("distance") or 0,
            "elevation_gain": act.get("total_elevation_gain") or 0,
            "training_load": act.get("suffer_score"),
            "hr_avg": round(act["average_heartrate"]) if act.get("average_heartrate") else None,
            "calories": act.get("calories"),
            "location_label": act.get("location_city")
            or act.get("location_state")
            or (act.get("timezone", "").split("/")[-1] if act.get("timezone") else "Unknown"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        supabase.table("activities").upsert(
            activity_data,
            on_conflict="user_id,strava_id",
        ).execute()
        inserted += 1

    update_user_settings(
        {
            "last_sync_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    print(f"Upserted {inserted} activities. Sync complete.")


def trigger_sync_background():
    if not sync_lock.acquire(blocking=False):
        print("Sync already running, skipping new request")
        return False

    def _run():
        try:
            sync()
        except Exception as e:
            print(f"Sync failed: {e}")
        finally:
            sync_lock.release()

    threading.Thread(target=_run, daemon=True).start()
    return True


class ManualSyncHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status: int = 200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_POST(self):
        if self.path != "/sync-now":
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Not found"}).encode("utf-8"))
            return

        started = trigger_sync_background()
        if not started:
            self._set_headers(409)
            self.wfile.write(json.dumps({"status": "busy", "message": "Sync already running"}).encode("utf-8"))
            return

        self._set_headers(202)
        self.wfile.write(json.dumps({"status": "started"}).encode("utf-8"))


def start_http_server():
    server = HTTPServer(("0.0.0.0", MANUAL_SYNC_PORT), ManualSyncHandler)
    print(f"[{datetime.now(timezone.utc).isoformat()}] Manual sync server listening on port {MANUAL_SYNC_PORT}")
    threading.Thread(target=server.serve_forever, daemon=True).start()


def main_loop():
    while True:
        now = datetime.now(timezone.utc)
        target = now.replace(hour=23, minute=30, second=0, microsecond=0)
        if target <= now:
            target = target + timedelta(days=1)

        sleep_seconds = (target - now).total_seconds()
        print(f"[{now.isoformat()}] Sleeping {int(sleep_seconds)}s until next sync at {target.isoformat()}")
        time.sleep(sleep_seconds)

        started = trigger_sync_background()
        if not started:
            print("Scheduled time reached but sync already running; skipping this run")


if __name__ == "__main__":
    mode = os.getenv("SYNC_MODE", "scheduled")

    if mode == "once":
        try:
            sync()
        except Exception as e:
            print(f"Sync failed: {e}")
    else:
        start_http_server()
        main_loop()


