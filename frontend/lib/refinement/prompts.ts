import type { Phase } from "./fsm";

export type CampaignContext = {
  title: string;
  description: string;
  questionBank: string | null;
  questionBankMode: "text" | "file";
};

export type ChatTurn = { role: "assistant" | "user"; content: string };

const interviewerSystemPrompt = (
  ctx: CampaignContext,
  feedback1: string | null,
  questionsAskedSoFar: number,
  maxQuestions: number
) => {
  const questionBankBlock = ctx.questionBank?.trim()
    ? `Question bank provided by the researcher (use as your primary source; you may rephrase for natural flow):\n${ctx.questionBank}`
    : ctx.questionBankMode === "file"
      ? "The researcher uploaded a PDF question bank that is not directly available to you. Derive plausible questions from the brief above."
      : "No question bank was provided. Derive plausible questions from the brief above.";

  const feedbackBlock = feedback1
    ? `\nThe researcher previously gave you this feedback after the first mock interview. Apply it now:\n${feedback1}\n`
    : "";

  return `You are a research interviewer running a mock interview so the researcher can pressure-test their question bank. The researcher (the user in this chat) is playing the role of a participant.

Research brief:
- Title: ${ctx.title}
- Description: ${ctx.description}

${questionBankBlock}
${feedbackBlock}
Rules:
- Ask EXACTLY one question per turn. No preambles longer than one short sentence.
- Stay focused; do not coach or break character mid-interview.
- Cap the interview at ${maxQuestions} questions total. You have already asked ${questionsAskedSoFar} of ${maxQuestions}.
- When you have asked the final question and received its answer, give a brief one-sentence wrap-up and set interviewComplete to true.
- If the user's previous answer warrants a probing follow-up, that follow-up counts as one of the ${maxQuestions} questions.

Respond ONLY as a JSON object matching this schema:
{
  "message": string,            // your next line to the participant (one question, OR the final wrap-up)
  "interviewComplete": boolean  // true only on the wrap-up turn
}`;
};

const feedbackSystemPrompt = (
  ctx: CampaignContext,
  round: 1 | 2
) => `You just finished mock interview ${round} for the research campaign "${ctx.title}". The researcher will now give you feedback on how the interview went and what they want to change.

Rules:
- Give a SHORT acknowledgment (1-2 sentences). Do not summarize their feedback back to them. Do not ask follow-up questions unless something is genuinely unclear.
- Do not start a new interview here. The researcher controls when the next phase begins.

Respond ONLY as a JSON object:
{
  "message": string,
  "interviewComplete": false
}`;

export function buildSystemPrompt(args: {
  phase: Phase;
  ctx: CampaignContext;
  feedback1: string | null;
  questionsAskedSoFar: number;
  maxQuestions: number;
}): string {
  switch (args.phase) {
    case "S1_INTERVIEW_1":
      return interviewerSystemPrompt(
        args.ctx,
        null,
        args.questionsAskedSoFar,
        args.maxQuestions
      );
    case "S3_INTERVIEW_2":
      return interviewerSystemPrompt(
        args.ctx,
        args.feedback1,
        args.questionsAskedSoFar,
        args.maxQuestions
      );
    case "S2_FEEDBACK_1":
      return feedbackSystemPrompt(args.ctx, 1);
    case "S4_FEEDBACK_2":
      return feedbackSystemPrompt(args.ctx, 2);
    case "DONE":
      return "The session is complete. Return an empty acknowledgment.";
  }
}

export function buildFinalizeSystemPrompt(): string {
  return `You are summarizing an AI-led research-question refinement session. You will receive the original brief, two mock interview transcripts (each up to 6 Q&A pairs), and two rounds of feedback the researcher gave between/after the interviews.

Your job: produce concrete, ready-to-use improvements to the question bank.

Respond ONLY as a JSON object matching this schema:
{
  "improved_questions": string[],   // a refined ordered list of interview questions, incorporating both rounds of feedback
  "key_themes": string[],           // short labels for the main themes that emerged across both interviews
  "notes": string                   // 2-4 sentences describing the most important changes from the original question bank
}`;
}
