# MyDash Setup Guide

## Complete Backend Implementation

Your app now has a **fully functional backend** with:

1. **Supabase Database** - Stores all your activities and settings
2. **OAuth Integration** - Connects securely to Strava
3. **Sync Engine** - Downloads all past activities and syncs new ones
4. **Scheduled Jobs** - Automatically syncs daily at 23:00
5. **Authentication** - Secure user accounts with RLS

## What Was Missing Before

The original app was just showing mock data. There was:
- No database connection
- No Strava API integration
- No sync mechanism
- No way to save or retrieve activities

## What's Been Built

### Database Schema
- `user_settings` table - Stores Strava OAuth tokens and sync status
- `activities` table - Stores all your Strava activities
- Row Level Security - Users can only see their own data

### Edge Functions (Backend API)
1. **strava-oauth** - Handles Strava authorization and token exchange
2. **strava-sync** - Fetches activities from Strava API and saves to database
3. **scheduled-sync** - Runs daily at 23:00 to sync all users automatically

### Frontend Updates
- Authentication wrapper with sign up/login
- Settings page with real OAuth flow
- Activity list that loads from database
- Manual sync button that actually works

## Setup Steps

### 1. Create Supabase Account
Visit [supabase.com](https://supabase.com) and create a free account.

### 2. Get Supabase Credentials
1. Create a new project
2. Go to Project Settings > API
3. Copy your Project URL and anon key
4. Create `.env` file:
```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Database Is Already Set Up
The migrations have already been applied to create:
- Tables with proper schema
- Row Level Security policies
- Indexes for performance
- Scheduled cron job

### 4. Edge Functions Are Already Deployed
All three Edge Functions are deployed and ready:
- `strava-oauth`
- `strava-sync`
- `scheduled-sync`

### 5. Get Strava API Credentials

1. Go to [https://www.strava.com/settings/api](https://www.strava.com/settings/api)
2. Create a new application:
   - **Application Name**: MyDash (or whatever you want)
   - **Category**: Choose appropriate category
   - **Website**: Your website or http://localhost:5173 for development
   - **Authorization Callback Domain**: `localhost` for development (or your production domain)
3. Copy your **Client ID** and **Client Secret**

### 6. Run the App

```bash
npm install
npm run dev
```

### 7. First Time Use

1. Open http://localhost:5173
2. **Sign Up** with email and password (this creates your account in Supabase)
3. Go to **Settings** tab
4. Enter your Strava Client ID and Client Secret
5. Click **Connect to Strava**
6. You'll be redirected to Strava - click **Authorize**
7. You'll be redirected back to the app
8. Click **Trigger Manual Sync** to download all your activities

### 8. Verify It's Working

- Check the Settings page - it should show "Connected" status
- Check the Dashboard - you should see your actual activities
- Use the filters to search through your activities

## How the Sync Works

### Manual Sync
1. User clicks "Trigger Manual Sync"
2. App calls the `strava-sync` Edge Function
3. Function fetches activities from Strava API
4. Activities are saved to your database
5. Duplicates are automatically handled (upsert)

### Automatic Daily Sync
1. At 23:00 UTC every day, pg_cron triggers the `scheduled-sync` function
2. Function loops through all users who have connected Strava
3. For each user, it fetches new activities since last sync
4. Activities are saved to database
5. Last sync timestamp is updated

## Troubleshooting

### "Not Connected" Status
- Make sure you entered the correct Strava Client ID and Secret
- Check that you clicked "Connect to Strava" and completed authorization
- Look in browser console for any error messages

### No Activities After Sync
- Check that you authorized the app on Strava
- Verify your Strava account actually has activities
- Check browser console for errors
- Check Supabase logs in your project dashboard

### Sync Button Does Nothing
- Open browser console (F12) to see error messages
- Make sure .env file has correct Supabase credentials
- Verify Edge Functions are deployed in Supabase dashboard

### Can't Sign Up/Login
- Check .env file has correct Supabase credentials
- Check Supabase project is running (not paused)
- Look for errors in browser console

## Architecture Overview

```
User Browser
    ↓
React App (Frontend)
    ↓
Supabase Auth (Authentication)
    ↓
Edge Functions (Backend API)
    ↓
Strava API ← → Supabase Database
    ↑
pg_cron (Scheduled Jobs)
```

## Security Features

- **Row Level Security**: Users can only access their own data
- **Secure Token Storage**: Strava tokens encrypted in database
- **JWT Authentication**: All API calls require valid user session
- **CORS Protection**: Edge Functions use proper CORS headers

## What Gets Synced

For each activity, the app stores:
- Sport type (run, ride, swim, etc.)
- Name and location
- Start date/time
- Duration (moving time)
- Distance
- Elevation gain
- Training load (suffer score)
- Average heart rate
- Calories burned

## Future Enhancements

You can extend this by:
- Adding Google Calendar integration for planning
- Adding Google Fit for daily metrics
- Building a mobile app
- Adding activity goals and achievements
- Creating custom training plans
- Exporting data to CSV/JSON

## Need Help?

Check:
1. Browser console for frontend errors
2. Supabase logs for backend errors
3. Strava API documentation
4. Supabase documentation
