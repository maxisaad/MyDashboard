# MyDash - Personal Raspberry Pi Dashboard

A high-contrast, data-dense personal dashboard designed for Raspberry Pi. It visualizes Strava activity data, tracks daily metrics, and manages your schedule with a privacy-focused, self-hosted architecture.

<img src="public/logo.png" alt="MyDash Logo" width="200">

## Features

- **Strava Integration**: Automatically sync all your past and new activities from Strava
- **Activity Tracking**: Visualize runs, rides, swims, and gym sessions with Coros-inspired aesthetics
- **Weekly Analysis**: Heatmap visualization of weekly consistency (Last, Current, and Next Week)
- **Advanced Filtering**: Filter activities by sport type, name, distance, and date range
- **Auto Sync**: Daily automatic synchronization at 23:00 to fetch new activities
- **Privacy First**: Self-hosted on your hardware. Data stays with you
- **Supabase Backend**: Secure database storage with Row Level Security

## Prerequisites

Before starting, ensure you have the following installed on your machine (Raspberry Pi, Mac, Windows, or Linux):

1.  **Node.js**: The runtime environment for the application.
    *   **Minimum Version**: v18.0.0
    *   **Check version**: Run `node -v` in your terminal.
    *   *If not installed*: Download from [nodejs.org](https://nodejs.org/) or use a version manager like `nvm` or `fnm`.
2.  **npm (Node Package Manager)**: Usually comes installed with Node.js.
    *   **Check version**: Run `npm -v`.

## Installation & Setup Guide

### 1. Clone the Project
First, get the code onto your local machine.
```bash
git clone https://github.com/yourusername/mydash.git
cd mydash
```

### 2. Install Dependencies
This project relies on several external libraries. You must install them before running the app.
Yes, `npm install` is the correct command! It reads the `package.json` file and downloads the following key technologies into the `node_modules` folder:

*   **react & react-dom**: The core UI framework.
*   **lucide-react**: For the beautiful vector icons.
*   **recharts**: For charting and data visualization.
*   **vite**: The build tool and development server (extremely fast).
*   **tailwindcss**: For utility-first CSS styling.


**Run the command:**
```bash
npm install
```

### 3. Configure Supabase

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Copy your project URL and anon key from Project Settings > API
4. Create a `.env` file in the project root:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

The database schema and Edge Functions are already deployed for you!

### 4. Get Your Strava API Credentials

1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Create a new application
3. Set Authorization Callback Domain to your domain (e.g., `localhost:5173` for local dev)
4. Copy your Client ID and Client Secret

### 5. Run the Development Server

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### 6. First Time Setup

1. Create an account (sign up with email/password)
2. Go to Settings tab
3. Enter your Strava Client ID and Client Secret
4. Click "Connect to Strava"
5. Authorize the app
6. Click "Trigger Manual Sync" to download all your activities

### 7. Build for Production (Optional)

```bash
npm run build
```

This creates a `dist` folder containing the optimized HTML, CSS, and JS files.

## How It Works

### Strava Integration
- When you connect your Strava account, the app stores your OAuth tokens securely in the database
- The sync function fetches all activities from Strava and stores them in your personal database
- Each activity includes: sport type, duration, distance, elevation, heart rate, calories, and more

### Automatic Sync
- A scheduled job runs every day at 23:00 (UTC)
- It automatically checks for new activities since your last sync
- All users with connected Strava accounts are synced automatically

### Data Privacy
- All your data is stored in your own Supabase database
- Row Level Security ensures users can only access their own data
- You control your data and can export or delete it anytime

## Project Structure

```
/mydash
  ├── components/      # React UI components (ActivityList, Heatmap, etc.)
  ├── services/        # Mock data and API services
  ├── types.ts         # TypeScript definitions
  ├── App.tsx          # Main application entry point
  ├── index.html       # HTML entry point
  ├── package.json     # Project dependencies and scripts
  └── vite.config.ts   # Build tool configuration
```
