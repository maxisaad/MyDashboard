/*
  # Setup Daily Sync Cron Job

  1. Extensions
    - Enable pg_cron extension for scheduled jobs

  2. Cron Job
    - Schedule daily sync at 23:00 UTC
    - Calls the scheduled-sync Edge Function
    - Runs every day to sync new Strava activities

  3. Notes
    - The job will automatically sync activities for all connected users
    - Uses service role key for authentication
    - If a user hasn't synced before, it will fetch the last 7 days of activities
*/

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily sync at 23:00 UTC (11 PM)
-- This will call the scheduled-sync edge function every day
SELECT cron.schedule(
  'daily-strava-sync',
  '0 23 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://' || current_setting('app.settings.project_ref') || '.supabase.co/functions/v1/scheduled-sync',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);
