# MyDash

A high-contrast, data-dense personal dashboard for Raspberry Pi. It syncs Strava activity data, tracks your training, and manages your schedule — all stored locally with zero cloud dependencies.

## Features

- **Strava Integration** — auto-sync all your past and new activities
- **Activity Tracking** — visualize runs, rides, swims, and gym sessions
- **Weekly Heatmap** — consistency view across last, current, and next week
- **Advanced Filtering** — filter by sport, name, distance, and date range
- **Auto Sync** — daily sync at 23:30 UTC
- **Privacy First** — everything stored locally in SQLite, no cloud

## Architecture

```
┌─────────────┐      HTTP       ┌──────────────────────┐      Strava API
│  React App  │ ◄──────────────► │  Python Server (:8765)│ ◄─────────────► Strava
│  (Vite)     │   /api/*        │  SQLite + Sync + API  │
└─────────────┘                  └──────────────────────┘
```

- **Frontend**: React + Tailwind CSS, served by Vite (dev) or any static server (prod)
- **Backend**: Python script that syncs with Strava, stores data in SQLite, and serves a local HTTP API
- **Database**: SQLite file at `./data/mydash.db`

## Requirements

- **Node.js** ≥ 18
- **Python** ≥ 3.10
- A [Strava API](https://www.strava.com/settings/api) application

## Setup

### 1. Clone and install

```bash
git clone https://github.com/maxisaad/MyDashboard.git
cd MyDashboard
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your Strava credentials
```

### 3. Set up the Python backend

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-sync.txt
```

### 4. Start the Python server

```bash
source venv/bin/activate
python local_strava_sync.py
```

This starts the API server on `http://localhost:8765` and schedules daily syncs at 23:30 UTC.

### 5. Connect Strava

Open `http://localhost:8765/connect-strava` in your browser and authorize the app.

### 6. Start the frontend

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

### 7. First sync

Go to Settings → click **Sync Now** to fetch your activities.

## Manual sync

```bash
SYNC_MODE=once python local_strava_sync.py
```

## API Endpoints

The Python server exposes these endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/activities` | All activities (JSON) |
| GET | `/api/settings` | Connection status and last sync time |
| GET | `/api/health` | Health check |
| POST | `/sync-now` | Trigger an immediate sync |
| GET | `/connect-strava` | Start Strava OAuth flow |
| GET | `/strava-callback` | OAuth callback handler |
| POST | `/strava/disconnect` | Remove Strava tokens |

## Build for production

```bash
npm run build
```

This creates a `dist/` folder. Serve it with any static file server (nginx, Caddy, etc.) alongside the Python backend.

## Project Structure

```
MyDashboard/
├── components/          # React UI components
├── services/            # Mock data (temporary)
├── App.tsx              # Main app entry point
├── index.tsx            # React DOM mount
├── index.html           # HTML shell
├── index.css            # Tailwind CSS entry
├── types.ts             # TypeScript definitions
├── local_strava_sync.py # Python: sync + SQLite + API server
├── data/                # SQLite database (created at runtime)
├── tailwind.config.js   # Tailwind configuration
├── postcss.config.js    # PostCSS configuration
└── vite.config.ts       # Vite build configuration
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `STRAVA_CLIENT_ID` | Yes | Strava app Client ID |
| `STRAVA_CLIENT_SECRET` | Yes | Strava app Client Secret |
| `API_PORT` | No | API server port (default: 8765) |
| `DB_PATH` | No | SQLite database path (default: `./data/mydash.db`) |
| `VITE_API_URL` | No | Frontend API URL (default: `http://localhost:8765`) |
