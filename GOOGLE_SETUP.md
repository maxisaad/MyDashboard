# Google Calendar Setup Guide

## 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or reuse an existing one)
3. Note your project name/ID

## 2. Enable Google Calendar API

1. In the left sidebar, go to **APIs & Services → Library**
2. Search for "Google Calendar API"
3. Click **Enable**

## 3. Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Choose **External** (or Internal if using Google Workspace)
3. Fill in the required fields:
   - App name: `MyDashboard` (or your preferred name)
   - User support email: your email
   - Developer contact: your email
4. Click **Save and Continue**
5. On the **Scopes** page, click **Add or Remove Scopes**
6. Add this scope: `https://www.googleapis.com/auth/calendar.readonly`
7. Click **Save and Continue**
8. Add your Google account as a **Test User** (if in Testing mode)
9. Click **Save and Continue**

## 4. Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `MyDashboard`
5. Under **Authorized redirect URIs**, add:
   ```
   https://your-domain.com/gcal-callback
   ```
   (Replace `your-domain.com` with your actual domain)
6. Click **Create**
7. Copy the **Client ID** and **Client Secret**

## 5. Configure MyDash

Add to your `.env` file:

```env
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
```

Then restart the server:

```bash
docker compose up -d --build
```

## 6. Connect

1. Open MyDash in your browser
2. Go to **Settings**
3. Click **Connect Google Calendar**
4. Sign in with your Google account and approve the permissions
5. You'll be redirected back — events will start syncing automatically

## Notes

- The integration is **read-only** — you can view events but not create/edit them
- Events sync automatically every **30 minutes**
- Only events from 7 days ago to 90 days ahead are fetched
- Local events (created with the + button) are kept separate from Google events
- Disconnecting removes all Google events from the local cache

## Troubleshooting

### "Google Calendar not configured" error
- Make sure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `.env`
- Restart the server after updating `.env`

### "redirect_uri_mismatch" error
- The redirect URI in Google Cloud Console must exactly match your domain
- Make sure you're using `https://` (not `http://`)
- The path must be `/gcal-callback`

### Events not syncing
- Check the server logs: `docker compose logs mydash`
- Try clicking "Sync Now" in Settings
- If the refresh token was revoked, disconnect and reconnect

### "access_denied" error during OAuth
- Make sure your Google account is added as a Test User (if the app is in Testing mode)
- Or publish the app (set status to "In production") in the OAuth consent screen
