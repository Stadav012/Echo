import type { CampaignContext } from "./prompts";

export type Phase =
  | "S1_INTERVIEW_1"
  | "S2_FEEDBACK_1"
  | "S3_INTERVIEW_2"
  | "S4_FEEDBACK_2"
  | "DONE";

export const MAX_QUESTIONS = 6;

export type TransitionSignal =
  | { kind: "interviewComplete" }
  | { kind: "userAdvance" };

export function nextPhase(current: Phase, signal: TransitionSignal): Phase {
  if (signal.kind === "interviewComplete") {
    if (current === "S1_INTERVIEW_1") return "S2_FEEDBACK_1";
    if (current === "S3_INTERVIEW_2") return "S4_FEEDBACK_2";
    return current;
  }

  if (current === "S2_FEEDBACK_1") return "S3_INTERVIEW_2";
  if (current === "S4_FEEDBACK_2") return "DONE";
  return current;
}

export function isInterviewPhase(phase: Phase): boolean {
  return phase === "S1_INTERVIEW_1" || phase === "S3_INTERVIEW_2";
}

export function isFeedbackPhase(phase: Phase): boolean {
  return phase === "S2_FEEDBACK_1" || phase === "S4_FEEDBACK_2";
}

export function phaseLabel(phase: Phase, questionsAsked: number): string {
  switch (phase) {
    case "S1_INTERVIEW_1":
      return `Mock Interview 1 - Q ${Math.min(questionsAsked + 1, MAX_QUESTIONS)}/${MAX_QUESTIONS}`;
    case "S3_INTERVIEW_2":
      return `Mock Interview 2 - Q ${Math.min(questionsAsked + 1, MAX_QUESTIONS)}/${MAX_QUESTIONS}`;
    case "S2_FEEDBACK_1":
      return "Feedback round 1";
    case "S4_FEEDBACK_2":
      return "Feedback round 2";
    case "DONE":
      return "Refinement complete";
  }
}

type CampaignRow = {
  title: string | null;
  description: string | null;
  question_bank_text: string | null;
  question_bank_mode: "text" | "file" | null;
};

export function buildCampaignContext(row: CampaignRow): CampaignContext {
  return {
    title: row.title ?? "Untitled Research",
    description: row.description ?? "",
    questionBank: row.question_bank_text,
    questionBankMode: row.question_bank_mode ?? "text",
  };
}
