import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SPORT_TYPE_MAP: Record<string, string> = {
  "Run": "Run",
  "TrailRun": "Run",
  "VirtualRun": "Run",
  "Ride": "Ride",
  "VirtualRide": "Ride",
  "MountainBikeRide": "Ride",
  "GravelRide": "Ride",
  "EBikeRide": "Ride",
  "Swim": "Swim",
  "WeightTraining": "WeightTraining",
  "Workout": "WeightTraining",
  "Hike": "Hike",
  "Walk": "Hike",
};

async function refreshStravaToken(
  supabaseClient: any,
  settings: any,
  clientId: string,
  clientSecret: string
) {
  const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: settings.strava_refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to refresh token");
  }

  const tokenData = await tokenResponse.json();
  const expiresAt = new Date(tokenData.expires_at * 1000).toISOString();

  await supabaseClient
    .from("user_settings")
    .update({
      strava_access_token: tokenData.access_token,
      strava_refresh_token: tokenData.refresh_token,
      strava_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", settings.user_id);

  return tokenData.access_token;
}

async function getValidAccessToken(
  supabaseClient: any,
  settings: any,
  clientId: string,
  clientSecret: string
) {
  const now = new Date();
  const expiresAt = new Date(settings.strava_token_expires_at);

  if (now >= expiresAt) {
    return await refreshStravaToken(supabaseClient, settings, clientId, clientSecret);
  }

  return settings.strava_access_token;
}

async function fetchRecentActivities(accessToken: string, after: number) {
  const url = new URL("https://www.strava.com/api/v3/athlete/activities");
  url.searchParams.set("per_page", "200");
  url.searchParams.set("after", after.toString());

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch activities: ${response.statusText}`);
  }

  return await response.json();
}

async function syncUserActivities(supabaseAdmin: any, userId: string, clientId: string, clientSecret: string) {
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (settingsError || !settings || !settings.strava_access_token) {
    console.log(`Skipping user ${userId}: no Strava connection`);
    return { skipped: true };
  }

  const accessToken = await getValidAccessToken(
    supabaseAdmin,
    settings,
    clientId,
    clientSecret
  );

  let afterTimestamp = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
  if (settings.last_sync_at) {
    afterTimestamp = Math.floor(new Date(settings.last_sync_at).getTime() / 1000);
  }

  const stravaActivities = await fetchRecentActivities(accessToken, afterTimestamp);

  let processedCount = 0;

  for (const activity of stravaActivities) {
    const sportType = SPORT_TYPE_MAP[activity.sport_type] || "Run";

    const activityData = {
      user_id: userId,
      strava_id: activity.id,
      sport_type: sportType,
      name: activity.name,
      start_date: activity.start_date,
      duration: activity.moving_time || activity.elapsed_time,
      distance: activity.distance,
      elevation_gain: activity.total_elevation_gain,
      training_load: activity.suffer_score || null,
      hr_avg: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
      calories: activity.calories || null,
      location_label: activity.location_city || activity.location_state || activity.timezone?.split("/")[1] || "Unknown",
      updated_at: new Date().toISOString(),
    };

    await supabaseAdmin
      .from("activities")
      .upsert(activityData, {
        onConflict: "user_id,strava_id",
        ignoreDuplicates: false,
      });

    processedCount++;
  }

  await supabaseAdmin
    .from("user_settings")
    .update({
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return { processedCount };
}

Deno.serve(async (req: Request) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const clientId = Deno.env.get("STRAVA_CLIENT_ID");
    const clientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      throw new Error("Missing Strava credentials in environment");
    }

    const { data: allSettings, error } = await supabaseAdmin
      .from("user_settings")
      .select("user_id")
      .not("strava_access_token", "is", null);

    if (error) {
      throw error;
    }

    const results = [];

    for (const setting of allSettings || []) {
      try {
        const result = await syncUserActivities(supabaseAdmin, setting.user_id, clientId, clientSecret);
        results.push({ userId: setting.user_id, ...result });
      } catch (error) {
        console.error(`Error syncing user ${setting.user_id}:`, error);
        results.push({ userId: setting.user_id, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        syncedUsers: results.length,
        results,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Scheduled sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
});
