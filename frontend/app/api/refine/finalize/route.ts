import { NextRequest, NextResponse } from "next/server";

import {
  buildFinalizeSystemPrompt,
  type CampaignContext,
  type ChatTurn,
} from "@/lib/refinement/prompts";

export const runtime = "nodejs";

type FinalizeRequest = {
  campaignContext: CampaignContext;
  transcript1: ChatTurn[];
  feedback1: string;
  transcript2: ChatTurn[];
  feedback2: string;
};

export type RefinementSummary = {
  improved_questions: string[];
  key_themes: string[];
  notes: string;
};

type ModelMessage = {
  role: "system" | "assistant" | "user";
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

function parseModelJson(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const slice = raw.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(slice) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function shouldUseGemini(): boolean {
  if (process.env.LLM_PROVIDER?.toLowerCase() === "gemini") return true;
  return Boolean(process.env.GEMINI_API_KEY) && !process.env.OPENROUTER_API_KEY;
}

function shouldUseQwen(): boolean {
  return process.env.LLM_PROVIDER?.toLowerCase() === "qwen";
}

async function sendChatCompletion(
  messages: ModelMessage[],
  temperature: number
): Promise<string> {
  const qwenKey = process.env.QWEN_API_KEY || process.env.qwen_api_key;
  const providers = shouldUseQwen()
    ? [
        {
          name: "qwen",
          endpoint:
            "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
          apiKey: qwenKey,
          model: process.env.QWEN_MODEL || "qwen-vl-max",
        },
        {
          name: "gemini",
          endpoint:
            "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          apiKey: process.env.GEMINI_API_KEY,
          model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        },
      ]
    : shouldUseGemini()
      ? [
          {
            name: "gemini",
            endpoint:
              "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            apiKey: process.env.GEMINI_API_KEY,
            model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
          },
          {
            name: "openrouter",
            endpoint: "https://openrouter.ai/api/v1/chat/completions",
            apiKey: process.env.OPENROUTER_API_KEY,
            model:
              process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-super-120b-a12b:free",
          },
        ]
      : [
          {
            name: "openrouter",
            endpoint: "https://openrouter.ai/api/v1/chat/completions",
            apiKey: process.env.OPENROUTER_API_KEY,
            model:
              process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-super-120b-a12b:free",
          },
          {
            name: "gemini",
            endpoint:
              "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            apiKey: process.env.GEMINI_API_KEY,
            model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
          },
        ];

  let lastError = "No provider configured.";
  for (const provider of providers) {
    if (!provider.apiKey) continue;
    const resp = await fetch(provider.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        response_format: { type: "json_object" },
        temperature,
      }),
    });
    const rawBody = await resp.text();
    if (!resp.ok) {
      lastError = `${provider.name} failed (${resp.status}): ${rawBody}`;
      continue;
    }
    const json = JSON.parse(rawBody) as ChatCompletionResponse;
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  }
  throw new Error(lastError);
}

function renderTranscript(turns: ChatTurn[]): string {
  if (turns.length === 0) return "(empty)";
  return turns
    .map((t) => `${t.role === "assistant" ? "Interviewer" : "Participant"}: ${t.content}`)
    .join("\n");
}

export async function POST(req: NextRequest) {
  let body: FinalizeRequest;
  try {
    body = (await req.json()) as FinalizeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { campaignContext, transcript1, feedback1, transcript2, feedback2 } = body;

  if (!campaignContext) {
    return NextResponse.json(
      { error: "Missing campaignContext." },
      { status: 400 }
    );
  }

  const userPayload = `Original brief:
- Title: ${campaignContext.title}
- Description: ${campaignContext.description}

Original question bank:
${campaignContext.questionBank?.trim() || "(none provided as text)"}

--- Mock Interview 1 transcript ---
${renderTranscript(transcript1)}

--- Feedback after Interview 1 ---
${feedback1 || "(no feedback)"}

--- Mock Interview 2 transcript ---
${renderTranscript(transcript2)}

--- Final feedback after Interview 2 ---
${feedback2 || "(no feedback)"}`;

  try {
    const raw = await sendChatCompletion(
      [
        { role: "system", content: buildFinalizeSystemPrompt() },
        { role: "user", content: userPayload },
      ],
      0.4
    );
    const parsed = parseModelJson(raw) as Partial<RefinementSummary> | null;

    const summary: RefinementSummary = {
      improved_questions: parsed && Array.isArray(parsed.improved_questions)
        ? parsed.improved_questions.filter((s) => typeof s === "string")
        : [],
      key_themes: parsed && Array.isArray(parsed.key_themes)
        ? parsed.key_themes.filter((s) => typeof s === "string")
        : [],
      notes:
        parsed && typeof parsed.notes === "string"
          ? parsed.notes
          : raw.trim() || "Refinement summary was generated in plain text.",
    };

    return NextResponse.json(summary);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "LLM request failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
