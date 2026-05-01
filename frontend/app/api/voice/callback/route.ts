import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type TranscriptTurn = {
  role: string;
  text: string;
  timestamp?: string;
};

type CallbackPayload = {
  session_id: string;
  customer_id?: string;
  status: string;
  transcript: TranscriptTurn[];
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  completed_at?: string;
};

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase service-role env vars are not configured.");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex")}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function summariseTranscript(turns: TranscriptTurn[]): {
  fullText: string;
  excerpt: string;
  questionsCount: number;
  durationSeconds: number | null;
} {
  const cleaned = turns.filter(
    (t) => t.text && t.text.trim() && t.text.trim() !== "[CALL_STARTED]"
  );

  const fullText = cleaned
    .map((t) => `${t.role.toUpperCase()}: ${t.text.trim()}`)
    .join("\n");

  const firstAgent = cleaned.find((t) => t.role === "agent");
  const excerpt = (firstAgent?.text ?? cleaned[0]?.text ?? "").slice(0, 240);

  const questionsCount = cleaned.filter((t) => t.role === "agent").length;

  let durationSeconds: number | null = null;
  const tsValues = cleaned
    .map((t) => (t.timestamp ? Date.parse(t.timestamp) : NaN))
    .filter((n) => Number.isFinite(n));
  if (tsValues.length >= 2) {
    durationSeconds = Math.max(
      0,
      Math.round((Math.max(...tsValues) - Math.min(...tsValues)) / 1000)
    );
  }

  return { fullText, excerpt, questionsCount, durationSeconds };
}

function inferSentiment(
  turns: TranscriptTurn[]
): "positive" | "neutral" | "negative" | null {
  const participantText = turns
    .filter((t) => t.role?.toLowerCase() === "participant" && t.text?.trim())
    .map((t) => t.text.trim().toLowerCase())
    .join(" ");
  if (!participantText) return null;

  const positiveWords = [
    "good",
    "great",
    "easy",
    "helpful",
    "smooth",
    "love",
    "liked",
    "useful",
    "clear",
    "fast",
  ];
  const negativeWords = [
    "bad",
    "hard",
    "difficult",
    "confusing",
    "slow",
    "frustrating",
    "hate",
    "issue",
    "problem",
    "bug",
  ];

  let score = 0;
  for (const word of positiveWords) {
    if (participantText.includes(word)) score += 1;
  }
  for (const word of negativeWords) {
    if (participantText.includes(word)) score -= 1;
  }

  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

export async function POST(req: NextRequest) {
  const secret = process.env.VOICE_SERVICE_CALLBACK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Callback secret is not configured." },
      { status: 500 }
    );
  }

  const raw = await req.text();
  const signature = req.headers.get("x-signature");
  if (!verifySignature(raw, signature, secret)) {
    return NextResponse.json(
      { error: "Invalid signature." },
      { status: 401 }
    );
  }

  let payload: CallbackPayload;
  try {
    payload = JSON.parse(raw) as CallbackPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!payload.session_id) {
    return NextResponse.json(
      { error: "session_id is required." },
      { status: 400 }
    );
  }

  let supabase;
  try {
    supabase = getServiceClient();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Supabase init failed.",
      },
      { status: 500 }
    );
  }

  const { data: callRow, error: callLookupErr } = await supabase
    .from("calls")
    .select("id")
    .eq("session_id", payload.session_id)
    .maybeSingle<{ id: string }>();

  if (callLookupErr) {
    return NextResponse.json(
      { error: `Call lookup failed: ${callLookupErr.message}` },
      { status: 500 }
    );
  }
  if (!callRow) {
    return NextResponse.json(
      { error: "No call found for session_id." },
      { status: 404 }
    );
  }

  const summary = summariseTranscript(payload.transcript ?? []);
  const completedAt = payload.completed_at ?? new Date().toISOString();
  const newStatus =
    payload.status === "expired"
      ? "missed"
      : payload.status === "completed"
        ? summary.questionsCount > 0
          ? "completed"
          : "missed"
        : payload.status;

  const callUpdate: Record<string, unknown> = {
    status: newStatus,
    completed_at: completedAt,
  };
  if (summary.durationSeconds != null) {
    callUpdate.duration_seconds = summary.durationSeconds;
  }

  const { error: updateErr } = await supabase
    .from("calls")
    .update(callUpdate)
    .eq("id", callRow.id);
  if (updateErr) {
    return NextResponse.json(
      { error: `Failed to update call: ${updateErr.message}` },
      { status: 500 }
    );
  }

  if (summary.fullText.length > 0) {
    const inferredSentiment = inferSentiment(payload.transcript ?? []);
    const { error: transcriptErr } = await supabase.from("transcripts").insert({
      call_id: callRow.id,
      full_text: summary.fullText,
      excerpt: summary.excerpt || null,
      questions_count: summary.questionsCount,
      sentiment: inferredSentiment,
    });
    if (transcriptErr) {
      return NextResponse.json(
        { error: `Failed to insert transcript: ${transcriptErr.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
