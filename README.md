# MyDash - Personal Raspberry Pi Dashboard

A high-contrast, data-dense personal dashboard designed for Raspberry Pi. It visualizes Strava activity data, tracks daily metrics, and manages your schedule with a privacy-focused, self-hosted architecture.

![MyDash Logo](./public/logo.png)

## Features

- **Activity Tracking**: Visualize runs, rides, swims, and gym sessions with Coros-inspired aesthetics.
- **Weekly Analysis**: Heatmap visualization of weekly consistency color-coded by sport type.
- **Planning**: Monthly calendar view for upcoming events.
- **Privacy First**: Self-hosted on your hardware. Data stays with you.
- **PWA Ready**: Installable on iOS/Android with offline capabilities.

## Prerequisites

- **Raspberry Pi** (3B+ or 4 recommended) or any Linux server.
- **Docker** and **Docker Compose** installed.
- **Google & Strava API Keys** (for data sync features).

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/mydash.git
cd mydash
```

### 2. Setup Environment
Ensure your project structure looks like this:
```
/mydash
  ├── components/
  ├── services/
  ├── public/
  │    └── logo.png  <-- Add your logo here
  ├── data/          <-- Created automatically for persistent storage
  ├── docker-compose.yml
  ├── Dockerfile
  └── package.json
```

### 3. Deploy with Docker
Run the application in detached mode. This will build the container and start the web server.

```bash
docker-compose up -d --build
```

The dashboard will be available at: **http://raspberrypi.local:3000** (or your Pi's IP address).

## Development

To run the project locally on your machine:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Dev Server**:
   ```bash
   npm run dev
   ```

## Configuration

Navigate to the **Settings** tab in the app to input your API credentials:
- **Strava Client ID & Secret**: For fetching activities.
- **Google Client ID & Secret**: For Google Fit (Daily Rings) and Calendar.

## Architecture

- **Frontend**: React, Tailwind CSS, Recharts, Lucide Icons.
- **Build Tool**: Vite.
- **Container**: Node.js Alpine (Optimized for ARM64/Raspberry Pi).
- **Storage**: SQLite (Mapped to `./data` volume).
