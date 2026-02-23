-- Store Strava app credentials (Client ID + Secret) in Supabase so they persist
-- and can be used by scheduled sync and shown (masked) in Settings.
-- Only the Edge Functions (service role) can read/write; no RLS policies for users.

CREATE TABLE IF NOT EXISTS strava_app_credentials (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  strava_client_id text,
  strava_client_secret text,
  updated_at timestamptz DEFAULT now()
);

-- Ensure only one row can exist
INSERT INTO strava_app_credentials (id, strava_client_id, strava_client_secret, updated_at)
VALUES (1, NULL, NULL, now())
ON CONFLICT (id) DO NOTHING;

ALTER TABLE strava_app_credentials ENABLE ROW LEVEL SECURITY;

-- No policies: only service_role (Edge Functions with SUPABASE_SERVICE_ROLE_KEY) can access.
-- Authenticated users will use the strava-config Edge Function to get/set via the backend.
