import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function maskClientId(clientId: string | null): string | null {
  if (!clientId || clientId.length < 4) return clientId ? "***" : null;
  return clientId.slice(0, 2) + "***" + clientId.slice(-2);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (req.method === "GET") {
      const { data: row, error } = await supabaseAdmin
        .from("strava_app_credentials")
        .select("strava_client_id, strava_client_secret")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const configured = !!(row?.strava_client_id && row?.strava_client_secret);
      return new Response(
        JSON.stringify({
          configured,
          clientIdMasked: configured ? maskClientId(row!.strava_client_id) : null,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const clientId = body.clientId?.trim() || null;
      const clientSecret = body.clientSecret?.trim() || null;

      if (!clientId || !clientSecret) {
        return new Response(
          JSON.stringify({ error: "clientId and clientSecret are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabaseAdmin
        .from("strava_app_credentials")
        .upsert(
          {
            id: 1,
            strava_client_id: clientId,
            strava_client_secret: clientSecret,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          clientIdMasked: maskClientId(clientId),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(null, { status: 405, headers: corsHeaders });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
