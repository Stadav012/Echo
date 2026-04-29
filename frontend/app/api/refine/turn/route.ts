import { NextRequest, NextResponse } from "next/server";
import { OpenRouter } from "@openrouter/sdk";

import {
  MAX_QUESTIONS,
  type Phase,
  isInterviewPhase,
} from "@/lib/refinement/fsm";
import {
  buildSystemPrompt,
  type CampaignContext,
  type ChatTurn,
} from "@/lib/refinement/prompts";

export const runtime = "nodejs";

type TurnRequest = {
  phase: Phase;
  campaignContext: CampaignContext;
  history: ChatTurn[];
  userMessage: string;
  feedback1: string | null;
  questionsAskedSoFar: number;
};

type TurnResponse = {
  assistantMessage: string;
  interviewComplete: boolean;
};

type ModelMessage = {
  role: "system" | "assistant" | "user";
  content: string;
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

function getOpenRouter(): OpenRouter {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured on the server.");
  }
  return new OpenRouter({ apiKey });
}

export async function POST(req: NextRequest) {
  let body: TurnRequest;
  try {
    body = (await req.json()) as TurnRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    phase,
    campaignContext,
    history,
    userMessage,
    feedback1,
    questionsAskedSoFar,
  } = body;

  if (!phase || !campaignContext) {
    return NextResponse.json(
      { error: "Missing required fields: phase, campaignContext." },
      { status: 400 }
    );
  }

  let openrouter: OpenRouter;
  try {
    openrouter = getOpenRouter();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "OpenRouter is not ready.",
      },
      { status: 500 }
    );
  }

  const model =
    process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-super-120b-a12b:free";

  const systemPrompt = buildSystemPrompt({
    phase,
    ctx: campaignContext,
    feedback1,
    questionsAskedSoFar,
    maxQuestions: MAX_QUESTIONS,
  });

  const messages: ModelMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.map((turn) => ({
      role: turn.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: turn.content,
    })),
  ];

  if (userMessage && userMessage.trim().length > 0) {
    messages.push({ role: "user", content: userMessage });
  }

  try {
    const completion = await openrouter.chat.send({
      chatRequest: {
        model,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.7,
      },
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = parseModelJson(raw) as
      | (Partial<TurnResponse> & { message?: string })
      | null;

    const fallbackText = raw.trim() || "(no response)";
    const assistantMessage = parsed
      ? (parsed.assistantMessage ?? parsed.message ?? fallbackText)
      : fallbackText;

    let interviewComplete = parsed ? Boolean(parsed.interviewComplete) : false;

    // Hard cap: once MAX_QUESTIONS have already been asked, this turn should
    // end the interview regardless of the model's flag.
    if (
      isInterviewPhase(phase) &&
      questionsAskedSoFar >= MAX_QUESTIONS
    ) {
      interviewComplete = true;
    }

    const responseBody: TurnResponse = {
      assistantMessage,
      interviewComplete,
    };

    return NextResponse.json(responseBody);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "OpenRouter request failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
