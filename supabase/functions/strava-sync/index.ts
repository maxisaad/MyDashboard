import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

async function fetchAllActivities(accessToken: string, after?: number) {
  const allActivities = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const url = new URL("https://www.strava.com/api/v3/athlete/activities");
    url.searchParams.set("per_page", perPage.toString());
    url.searchParams.set("page", page.toString());
    if (after) {
      url.searchParams.set("after", after.toString());
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch activities: ${response.statusText}`);
    }

    const activities = await response.json();

    if (activities.length === 0) {
      break;
    }

    allActivities.push(...activities);

    if (activities.length < perPage) {
      break;
    }

    page++;
  }

  return allActivities;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const body = await req.json().catch(() => ({}));
    const clientId = body.clientId ?? Deno.env.get("STRAVA_CLIENT_ID");
    const clientSecret = body.clientSecret ?? Deno.env.get("STRAVA_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      throw new Error(
        "Strava credentials missing. Provide clientId/clientSecret in the request body or set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in the Edge Function environment."
      );
    }

    const { data: settings, error: settingsError } = await supabaseClient
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (settingsError) {
      throw settingsError;
    }

    if (!settings || !settings.strava_access_token) {
      throw new Error("Strava not connected. Please connect your Strava account first.");
    }

    const accessToken = await getValidAccessToken(
      supabaseClient,
      settings,
      clientId,
      clientSecret
    );

    let afterTimestamp: number | undefined;
    if (settings.last_sync_at) {
      afterTimestamp = Math.floor(new Date(settings.last_sync_at).getTime() / 1000);
    }

    const stravaActivities = await fetchAllActivities(accessToken, afterTimestamp);

    let insertedCount = 0;
    let updatedCount = 0;

    for (const activity of stravaActivities) {
      const sportType = SPORT_TYPE_MAP[activity.sport_type] || "Run";

      const activityData = {
        user_id: user.id,
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

      const { error: upsertError } = await supabaseClient
        .from("activities")
        .upsert(activityData, {
          onConflict: "user_id,strava_id",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error("Error upserting activity:", upsertError);
        continue;
      }

      insertedCount++;
    }

    await supabaseClient
      .from("user_settings")
      .update({
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return new Response(
      JSON.stringify({
        success: true,
        activitiesProcessed: stravaActivities.length,
        insertedCount,
        updatedCount,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
