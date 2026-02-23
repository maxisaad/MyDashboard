import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "authorize") {
      const body = await req.json().catch(() => ({}));
      let clientId = body.clientId ?? Deno.env.get("STRAVA_CLIENT_ID");
      const redirectUri = body.redirectUri;

      if (!clientId) {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );
        const { data: creds } = await supabaseAdmin
          .from("strava_app_credentials")
          .select("strava_client_id")
          .eq("id", 1)
          .maybeSingle();
        if (creds?.strava_client_id) clientId = creds.strava_client_id;
      }

      if (!clientId || !redirectUri) {
        throw new Error("Missing clientId or redirectUri. Save Strava credentials in Settings first, or set STRAVA_CLIENT_ID in Supabase secrets.");
      }

      const authUrl = new URL("https://www.strava.com/oauth/authorize");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("scope", "activity:read_all");
      authUrl.searchParams.set("state", user.id);

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (action === "exchange") {
      const body = await req.json().catch(() => ({}));
      const code = body.code;
      let clientId = body.clientId ?? Deno.env.get("STRAVA_CLIENT_ID");
      let clientSecret = body.clientSecret ?? Deno.env.get("STRAVA_CLIENT_SECRET");

      if (!code) {
        throw new Error("Missing authorization code from Strava.");
      }
      if (!clientId || !clientSecret) {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );
        const { data: creds } = await supabaseAdmin
          .from("strava_app_credentials")
          .select("strava_client_id, strava_client_secret")
          .eq("id", 1)
          .maybeSingle();
        if (creds?.strava_client_id && creds?.strava_client_secret) {
          clientId = creds.strava_client_id;
          clientSecret = creds.strava_client_secret;
        }
      }
      if (!clientId || !clientSecret) {
        throw new Error(
          "Missing Strava credentials. Save your Strava Client ID and Secret in Settings first, then connect again."
        );
      }

      const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error("Failed to exchange code for token");
      }

      const tokenData = await tokenResponse.json();

      const expiresAt = new Date(tokenData.expires_at * 1000).toISOString();

      const { error: upsertError } = await supabaseClient
        .from("user_settings")
        .upsert({
          user_id: user.id,
          strava_access_token: tokenData.access_token,
          strava_refresh_token: tokenData.refresh_token,
          strava_token_expires_at: expiresAt,
          strava_athlete_id: tokenData.athlete.id.toString(),
          updated_at: new Date().toISOString(),
        });

      if (upsertError) {
        throw upsertError;
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    throw new Error("Invalid action");
  } catch (error) {
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
