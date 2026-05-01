import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type CreateSessionBody = {
  research_campaign_id?: string;
  contact_id?: string;
};

type ResearchRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  question_bank_text: string | null;
  refinement_summary: Record<string, unknown> | null;
};

type ContactRow = {
  id: string;
  research_campaign_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  age: string | null;
  occupation: string | null;
};

type VoiceCreateResponse = {
  session_id: string;
  talk_url: string;
  expires_at: string;
};

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

function callbackBaseUrl(req: NextRequest): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) {
    throw new Error("Cannot determine callback base URL");
  }
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
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

  let body: CreateSessionBody;
  try {
    body = (await req.json()) as CreateSessionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const research_campaign_id = body.research_campaign_id?.trim();
  const contact_id = body.contact_id?.trim();
  if (!research_campaign_id || !contact_id) {
    return NextResponse.json(
      { error: "research_campaign_id and contact_id are required." },
      { status: 400 }
    );
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

  const { data: research, error: researchErr } = await serviceClient
    .from("research_campaigns")
    .select(
      "id, user_id, title, description, question_bank_text, refinement_summary"
    )
    .eq("id", research_campaign_id)
    .maybeSingle<ResearchRow>();

  if (researchErr) {
    return NextResponse.json(
      { error: `Research lookup failed: ${researchErr.message}` },
      { status: 500 }
    );
  }
  let resolvedResearch: ResearchRow | null = research ?? null;

  // Legacy/defensive path: if research id lookup misses, derive the campaign
  // via contact_id and then fetch that campaign. This avoids false 404s when
  // stale ids are sent from UI state.
  if (!resolvedResearch) {
    const { data: contactWithCampaign } = await serviceClient
      .from("contact_list")
      .select("research_campaign_id")
      .eq("id", contact_id)
      .maybeSingle<{ research_campaign_id: string }>();

    if (contactWithCampaign?.research_campaign_id) {
      const { data: derivedResearch } = await serviceClient
        .from("research_campaigns")
        .select("id, user_id, title, description, question_bank_text, refinement_summary")
        .eq("id", contactWithCampaign.research_campaign_id)
        .maybeSingle<ResearchRow>();
      resolvedResearch = derivedResearch ?? null;
    }
  }

  if (!resolvedResearch) {
    return NextResponse.json(
      {
        error: "Research campaign not found.",
        debug: { research_campaign_id, contact_id, user_id: userId },
      },
      { status: 404 }
    );
  }
  if (resolvedResearch.user_id !== userId) {
    return NextResponse.json(
      {
        error: "Research campaign belongs to a different user.",
        debug: {
          research_campaign_id,
          request_user_id: userId,
          owner_user_id: resolvedResearch.user_id,
        },
      },
      { status: 403 }
    );
  }

  const { data: contact, error: contactErr } = await serviceClient
    .from("contact_list")
    .select("id, research_campaign_id, name, phone, email, age, occupation")
    .eq("id", contact_id)
    .eq("research_campaign_id", resolvedResearch.id)
    .maybeSingle<ContactRow>();

  if (contactErr || !contact) {
    return NextResponse.json(
      { error: "Contact not found in this campaign." },
      { status: 404 }
    );
  }

  let campaignId: string | null = null;
  const { data: latestCallWithCampaign } = await serviceClient
    .from("calls")
    .select("campaign_id")
    .eq("research_campaign_id", resolvedResearch.id)
    .not("campaign_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ campaign_id: string }>();
  if (latestCallWithCampaign?.campaign_id) {
    campaignId = latestCallWithCampaign.campaign_id;
  }

  if (!campaignId) {
    const { data: createdCampaign, error: campaignErr } = await serviceClient
      .from("campaigns")
      .insert({
        user_id: userId,
        name: resolvedResearch.title,
        description: resolvedResearch.description ?? "",
        status: "active",
      })
      .select("id")
      .single<{ id: string }>();

    if (campaignErr || !createdCampaign) {
      return NextResponse.json(
        {
          error: `Failed to create campaign shell: ${
            campaignErr?.message ?? "unknown error"
          }`,
        },
        { status: 500 }
      );
    }
    campaignId = createdCampaign.id;

    const { error: linkErr } = await serviceClient
      .from("research_campaigns")
      .update({ campaign_id: campaignId, updated_at: new Date().toISOString() })
      .eq("id", resolvedResearch.id);
    if (linkErr && !linkErr.message.includes("column") && !linkErr.message.includes("campaign_id")) {
      return NextResponse.json(
        { error: `Failed to link campaign to research: ${linkErr.message}` },
        { status: 500 }
      );
    }
  }

  const callbackUrl = `${callbackBaseUrl(req)}/api/voice/callback`;

  const metadata = {
    research_campaign_id: resolvedResearch.id,
    contact_id: contact.id,
    title: resolvedResearch.title,
    description: resolvedResearch.description ?? "",
    question_bank_text: resolvedResearch.question_bank_text,
    refinement_summary: resolvedResearch.refinement_summary,
    contact: {
      name: contact.name,
      age: contact.age,
      occupation: contact.occupation,
    },
  };

  let voiceResponse: VoiceCreateResponse;
  try {
    const resp = await fetch(`${voiceUrl.replace(/\/+$/, "")}/sessions/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": voiceApiKey,
      },
      body: JSON.stringify({
        customer_id: contact.id,
        customer_name: contact.name,
        context: resolvedResearch.title,
        callback_url: callbackUrl,
        metadata,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json(
        { error: `Voice service error (${resp.status}): ${text}` },
        { status: 502 }
      );
    }
    voiceResponse = (await resp.json()) as VoiceCreateResponse;
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

  const { error: callInsertErr } = await serviceClient.from("calls").insert({
    campaign_id: campaignId,
    research_campaign_id: resolvedResearch.id,
    contact_id: contact.id,
    session_id: voiceResponse.session_id,
    participant_name: contact.name,
    participant_phone: contact.phone,
    status: "pending",
  });
  if (callInsertErr) {
    return NextResponse.json(
      {
        error: `Failed to record call row: ${callInsertErr.message}`,
        talk_url: voiceResponse.talk_url,
        session_id: voiceResponse.session_id,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    talk_url: voiceResponse.talk_url,
    session_id: voiceResponse.session_id,
    expires_at: voiceResponse.expires_at,
  });
}
