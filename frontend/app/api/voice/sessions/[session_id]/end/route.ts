import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getAccessToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice("bearer ".length).trim();
  }
  return null;
}

function makeUserClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase env vars are not configured.");
  }
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase service-role env vars are not configured.");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ session_id: string }> }
) {
  const voiceUrl = process.env.VOICE_SERVICE_URL;
  const voiceApiKey = process.env.VOICE_SERVICE_API_KEY;
  if (!voiceUrl || !voiceApiKey) {
    return NextResponse.json(
      { error: "Voice service is not configured." },
      { status: 500 }
    );
  }

  const accessToken = getAccessToken(req);
  if (!accessToken) {
    return NextResponse.json(
      { error: "Missing Authorization bearer token." },
      { status: 401 }
    );
  }

  const { session_id } = await ctx.params;
  const sid = session_id?.trim();
  if (!sid) {
    return NextResponse.json({ error: "session_id is required." }, { status: 400 });
  }

  let userClient;
  let serviceClient;
  try {
    userClient = makeUserClient(accessToken);
    serviceClient = makeServiceClient();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Supabase init failed." },
      { status: 500 }
    );
  }

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }
  const userId = userData.user.id;

  const { data: call, error: callErr } = await serviceClient
    .from("calls")
    .select("id, research_campaign_id, session_id")
    .eq("session_id", sid)
    .maybeSingle<{ id: string; research_campaign_id: string | null; session_id: string | null }>();

  if (callErr) {
    return NextResponse.json(
      { error: `Call lookup failed: ${callErr.message}` },
      { status: 500 }
    );
  }
  if (!call?.research_campaign_id) {
    return NextResponse.json({ error: "Call not found for this session." }, { status: 404 });
  }

  const { data: research, error: rcErr } = await serviceClient
    .from("research_campaigns")
    .select("id, user_id")
    .eq("id", call.research_campaign_id)
    .maybeSingle<{ id: string; user_id: string }>();

  if (rcErr || !research) {
    return NextResponse.json({ error: "Research campaign not found." }, { status: 404 });
  }
  if (research.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const base = voiceUrl.replace(/\/+$/, "");
  try {
    const resp = await fetch(`${base}/sessions/${encodeURIComponent(sid)}/end`, {
      method: "POST",
      headers: { "X-API-Key": voiceApiKey },
    });
    const text = await resp.text();
    if (!resp.ok) {
      return NextResponse.json(
        { error: `Voice service error (${resp.status}): ${text}` },
        { status: 502 }
      );
    }
    let body: unknown = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    return NextResponse.json(body);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Voice service unreachable: ${error.message}`
            : "Voice service unreachable.",
      },
      { status: 502 }
    );
  }
}
