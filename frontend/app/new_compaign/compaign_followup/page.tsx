"use client";

import {
  FormEvent,
  KeyboardEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";
import {
  MAX_QUESTIONS,
  buildCampaignContext,
  isFeedbackPhase,
  isInterviewPhase,
  nextPhase,
  phaseLabel,
  type Phase,
} from "@/lib/refinement/fsm";
import type { CampaignContext, ChatTurn } from "@/lib/refinement/prompts";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type RefinementSummary = {
  improved_questions: string[];
  key_themes: string[];
  notes: string;
};

type CampaignRow = {
  id: string;
  title: string | null;
  description: string | null;
  question_bank_text: string | null;
  question_bank_mode: "text" | "file" | null;
};

const messageId = (() => {
  let counter = 0;
  return (prefix: string) => `${prefix}-${Date.now()}-${counter++}`;
})();

const STEPS: { id: Phase; label: string; short: string }[] = [
  { id: "S1_INTERVIEW_1", label: "Mock interview 1", short: "Interview 1" },
  { id: "S2_FEEDBACK_1", label: "Feedback round 1", short: "Feedback 1" },
  { id: "S3_INTERVIEW_2", label: "Mock interview 2", short: "Interview 2" },
  { id: "S4_FEEDBACK_2", label: "Feedback round 2", short: "Feedback 2" },
];

const PHASE_INDEX: Record<Phase, number> = {
  S1_INTERVIEW_1: 0,
  S2_FEEDBACK_1: 1,
  S3_INTERVIEW_2: 2,
  S4_FEEDBACK_2: 3,
  DONE: 4,
};

function phaseTitle(phase: Phase): string {
  switch (phase) {
    case "S1_INTERVIEW_1":
      return "Mock interview \u2014 round 1";
    case "S2_FEEDBACK_1":
      return "Your feedback \u2014 round 1";
    case "S3_INTERVIEW_2":
      return "Mock interview \u2014 round 2";
    case "S4_FEEDBACK_2":
      return "Your feedback \u2014 round 2";
    case "DONE":
      return "Refinement complete";
  }
}

function SendIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function CampaignFollowupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const researchId = searchParams.get("researchId");

  const [loadingCampaign, setLoadingCampaign] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<CampaignRow | null>(null);

  const [phase, setPhase] = useState<Phase>("S1_INTERVIEW_1");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // FSM-tracked state, kept in refs so async callbacks see fresh values
  const transcript1Ref = useRef<ChatTurn[]>([]);
  const transcript2Ref = useRef<ChatTurn[]>([]);
  const feedback1Ref = useRef<string>("");
  const feedback2Ref = useRef<string>("");
  const questionsAskedRef = useRef<number>(0);
  const interviewKickoffStartedRef = useRef<{ S1: boolean; S3: boolean }>({
    S1: false,
    S3: false,
  });

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const campaignContext: CampaignContext | null = useMemo(() => {
    if (!campaign) return null;
    return buildCampaignContext(campaign);
  }, [campaign]);

  const titleInitials = useMemo(() => {
    const t = campaign?.title || "Research Campaign";
    return (
      t
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "RC"
    );
  }, [campaign?.title]);

  // Force a tick to re-render the question counter / progress when refs change.
  const [, forceTick] = useState(0);
  const bumpProgress = useCallback(() => forceTick((n) => n + 1), []);

  // Auto-scroll on new messages / typing state.
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isThinking]);

  // Auto-grow textarea.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [inputValue]);

  // Load campaign.
  useEffect(() => {
    if (!researchId) {
      router.replace("/dashboard/campaigns");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingCampaign(true);
      const { data, error } = await supabase
        .from("research_campaigns")
        .select("id,title,description,question_bank_text,question_bank_mode")
        .eq("id", researchId)
        .single();

      if (cancelled) return;
      if (error || !data) {
        setLoadError("Could not load this research campaign.");
        setLoadingCampaign(false);
        return;
      }
      setCampaign(data as CampaignRow);
      setLoadingCampaign(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [researchId, router]);

  const callTurn = useCallback(
    async (args: {
      currentPhase: Phase;
      ctx: CampaignContext;
      history: ChatTurn[];
      userMessage: string;
      questionsAskedSoFar: number;
    }): Promise<{ assistantMessage: string; interviewComplete: boolean } | null> => {
      try {
        const res = await fetch("/api/refine/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phase: args.currentPhase,
            campaignContext: args.ctx,
            history: args.history,
            userMessage: args.userMessage,
            feedback1: feedback1Ref.current || null,
            questionsAskedSoFar: args.questionsAskedSoFar,
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || "Request failed.");
        }
        return (await res.json()) as {
          assistantMessage: string;
          interviewComplete: boolean;
        };
      } catch (error) {
        setErrorMsg(
          error instanceof Error ? error.message : "Failed to reach the AI."
        );
        return null;
      }
    },
    []
  );

  const appendAssistant = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: messageId("a"), role: "assistant", text },
    ]);
  }, []);

  const appendUser = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: messageId("u"), role: "user", text },
    ]);
  }, []);

  // Kick off interview phases automatically (AI speaks first).
  useEffect(() => {
    if (!campaignContext) return;

    if (
      phase === "S1_INTERVIEW_1" &&
      !interviewKickoffStartedRef.current.S1
    ) {
      interviewKickoffStartedRef.current.S1 = true;
      (async () => {
        setIsThinking(true);
        appendAssistant(
          `Hi \u2014 I'll run a quick mock interview for "${campaignContext.title}". I'll ask up to ${MAX_QUESTIONS} questions; answer as a participant would.`
        );
        const result = await callTurn({
          currentPhase: "S1_INTERVIEW_1",
          ctx: campaignContext,
          history: [],
          userMessage: "",
          questionsAskedSoFar: 0,
        });
        setIsThinking(false);
        if (!result) return;
        appendAssistant(result.assistantMessage);
        transcript1Ref.current.push({
          role: "assistant",
          content: result.assistantMessage,
        });
        questionsAskedRef.current = 1;
        bumpProgress();
        if (result.interviewComplete) {
          setPhase((p) => nextPhase(p, { kind: "interviewComplete" }));
        }
      })();
    }

    if (
      phase === "S3_INTERVIEW_2" &&
      !interviewKickoffStartedRef.current.S3
    ) {
      interviewKickoffStartedRef.current.S3 = true;
      questionsAskedRef.current = 0;
      bumpProgress();
      (async () => {
        setIsThinking(true);
        appendAssistant(
          "Thanks. Starting the second mock interview now, with your feedback applied."
        );
        const result = await callTurn({
          currentPhase: "S3_INTERVIEW_2",
          ctx: campaignContext,
          history: [],
          userMessage: "",
          questionsAskedSoFar: 0,
        });
        setIsThinking(false);
        if (!result) return;
        appendAssistant(result.assistantMessage);
        transcript2Ref.current.push({
          role: "assistant",
          content: result.assistantMessage,
        });
        questionsAskedRef.current = 1;
        bumpProgress();
        if (result.interviewComplete) {
          setPhase((p) => nextPhase(p, { kind: "interviewComplete" }));
        }
      })();
    }

    if (phase === "S2_FEEDBACK_1") {
      appendAssistant(
        "How did that feel? Tell me what to change for the next round \u2014 tone, depth, ordering, missing topics. Click \"Done with feedback\" when you're ready to move on."
      );
    }

    if (phase === "S4_FEEDBACK_2") {
      appendAssistant(
        "Great. Any final feedback before I write up your refined question bank? Click \"Finish refinement\" when done."
      );
    }
    // We deliberately depend only on phase + campaignContext readiness.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, campaignContext]);

  const handleInterviewTurn = useCallback(
    async (userText: string) => {
      if (!campaignContext) return;
      const transcriptRef =
        phase === "S1_INTERVIEW_1" ? transcript1Ref : transcript2Ref;

      transcriptRef.current.push({ role: "user", content: userText });

      // If the assistant has already asked MAX_QUESTIONS, this user message is
      // the final answer and we should move to feedback immediately.
      if (questionsAskedRef.current >= MAX_QUESTIONS) {
        setPhase((p) => nextPhase(p, { kind: "interviewComplete" }));
        return;
      }

      setIsThinking(true);
      const result = await callTurn({
        currentPhase: phase,
        ctx: campaignContext,
        history: transcriptRef.current,
        userMessage: "",
        questionsAskedSoFar: questionsAskedRef.current,
      });
      setIsThinking(false);
      if (!result) return;

      appendAssistant(result.assistantMessage);
      transcriptRef.current.push({
        role: "assistant",
        content: result.assistantMessage,
      });
      questionsAskedRef.current += 1;
      bumpProgress();

      if (result.interviewComplete) {
        setPhase((p) => nextPhase(p, { kind: "interviewComplete" }));
      }
    },
    [appendAssistant, bumpProgress, callTurn, campaignContext, phase]
  );

  const handleFeedbackTurn = useCallback(
    async (userText: string) => {
      if (!campaignContext) return;
      if (phase === "S2_FEEDBACK_1") {
        feedback1Ref.current = feedback1Ref.current
          ? `${feedback1Ref.current}\n${userText}`
          : userText;
      } else if (phase === "S4_FEEDBACK_2") {
        feedback2Ref.current = feedback2Ref.current
          ? `${feedback2Ref.current}\n${userText}`
          : userText;
      }

      setIsThinking(true);
      const result = await callTurn({
        currentPhase: phase,
        ctx: campaignContext,
        history: [],
        userMessage: userText,
        questionsAskedSoFar: questionsAskedRef.current,
      });
      setIsThinking(false);
      if (!result) return;
      appendAssistant(result.assistantMessage);
    },
    [appendAssistant, callTurn, campaignContext, phase]
  );

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || isThinking || isFinalizing) return;
    setErrorMsg(null);
    setInputValue("");
    appendUser(trimmed);

    if (isInterviewPhase(phase)) {
      await handleInterviewTurn(trimmed);
    } else if (isFeedbackPhase(phase)) {
      await handleFeedbackTurn(trimmed);
    }
  };

  const handleAdvance = useCallback(async () => {
    if (phase === "S2_FEEDBACK_1") {
      setPhase((p) => nextPhase(p, { kind: "userAdvance" }));
      return;
    }
    if (phase === "S4_FEEDBACK_2") {
      if (!campaignContext || !researchId) return;
      setIsFinalizing(true);
      setErrorMsg(null);
      try {
        const res = await fetch("/api/refine/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignContext,
            transcript1: transcript1Ref.current,
            feedback1: feedback1Ref.current,
            transcript2: transcript2Ref.current,
            feedback2: feedback2Ref.current,
          }),
        });
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const summary = (await res.json()) as RefinementSummary;

        const payload = {
          feedback_1: feedback1Ref.current,
          feedback_2: feedback2Ref.current,
          improved_questions: summary.improved_questions,
          key_themes: summary.key_themes,
          notes: summary.notes,
          completed_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from("research_campaigns")
          .update({ refinement_summary: payload })
          .eq("id", researchId);

        if (updateError) {
          throw new Error(updateError.message);
        }

        setPhase("DONE");
        router.push(`/dashboard/research/${researchId}`);
      } catch (error) {
        setErrorMsg(
          error instanceof Error
            ? error.message
            : "Could not finalize the refinement."
        );
      } finally {
        setIsFinalizing(false);
      }
    }
  }, [campaignContext, phase, researchId, router]);

  const advanceLabel =
    phase === "S2_FEEDBACK_1"
      ? "Done with feedback"
      : phase === "S4_FEEDBACK_2"
        ? isFinalizing
          ? "Finalizing\u2026"
          : "Finish refinement"
        : null;

  const canSend =
    inputValue.trim().length > 0 &&
    !isThinking &&
    !isFinalizing &&
    phase !== "DONE";

  // Step-by-step progress: each step contributes 25%; inside an interview
  // we add fractional progress as questions are asked.
  const progressPct = useMemo(() => {
    const phaseIdx = PHASE_INDEX[phase];
    if (phase === "DONE") return 100;
    let pct = phaseIdx * 25;
    if (isInterviewPhase(phase)) {
      const ratio = Math.min(questionsAskedRef.current / MAX_QUESTIONS, 1);
      pct += ratio * 25;
    } else if (isFeedbackPhase(phase)) {
      pct += 12;
    }
    return Math.min(pct, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, messages]);

  const phaseChipStyle = isInterviewPhase(phase)
    ? { background: "var(--primary-light)", color: "var(--primary-dark)" }
    : isFeedbackPhase(phase)
      ? { background: "var(--warning-light)", color: "#92400e" }
      : { background: "var(--success-light)", color: "#065f46" };

  const composerPlaceholder = isInterviewPhase(phase)
    ? "Type your answer as a participant\u2026"
    : isFeedbackPhase(phase)
      ? "Tell the AI what to change\u2026"
      : "Refinement complete";

  const composerDisabled =
    phase === "DONE" || isFinalizing || loadingCampaign || !!loadError;

  const onTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, var(--bg-base) 0%, var(--bg-elevated) 100%)",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "1080px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: "20px",
        }}
      >
        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <aside
          className="card"
          style={{
            padding: "22px",
            height: "fit-content",
            position: "sticky",
            top: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <Link
            href="/dashboard/campaigns"
            className="btn btn-ghost"
            style={{
              padding: "6px 10px",
              alignSelf: "flex-start",
              fontSize: "13px",
            }}
          >
            <ArrowLeftIcon />
            Back to campaigns
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              className="avatar avatar-sm"
              style={{ width: 40, height: 40, fontSize: 14 }}
            >
              {titleInitials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                className="text-xs"
                style={{
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Refinement
              </div>
              <div
                style={{
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  fontSize: "15px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={campaign?.title ?? ""}
              >
                {campaign?.title ?? (loadingCampaign ? "Loading\u2026" : "Untitled")}
              </div>
            </div>
          </div>

          <p
            className="text-secondary"
            style={{ lineHeight: 1.55, marginBottom: 0 }}
          >
            Two mock interviews and two feedback rounds. The AI asks up to{" "}
            {MAX_QUESTIONS} questions per round.
          </p>

          <div className="step-track">
            {STEPS.map((step, idx) => {
              const currentIdx = PHASE_INDEX[phase];
              const state =
                idx < currentIdx
                  ? "done"
                  : idx === currentIdx
                    ? "active"
                    : "pending";
              return (
                <div
                  key={step.id}
                  className={`step-item ${state === "done" ? "step-item-done" : ""}`}
                >
                  <div
                    className={`step-dot ${
                      state === "active"
                        ? "step-dot-active"
                        : state === "done"
                          ? "step-dot-done"
                          : ""
                    }`}
                  >
                    {state === "done" ? "\u2713" : idx + 1}
                  </div>
                  <div
                    className={`step-label ${state === "active" ? "step-label-active" : ""}`}
                  >
                    {step.label}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── Chat panel ──────────────────────────────────────────── */}
        <section
          className="card"
          style={{
            padding: 0,
            display: "flex",
            flexDirection: "column",
            height: "calc(100vh - 48px)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "18px 22px 14px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              background: "var(--bg-surface)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  className="text-xs"
                  style={{
                    color: "var(--text-muted)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Current step
                </div>
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginTop: "2px",
                  }}
                >
                  {phaseTitle(phase)}
                </div>
              </div>
              <span
                className="badge"
                style={{
                  ...phaseChipStyle,
                  fontWeight: 600,
                }}
              >
                <span
                  className="status-dot"
                  style={{
                    background: "currentColor",
                    opacity: 0.6,
                  }}
                />
                {phaseLabel(phase, questionsAskedRef.current)}
              </span>
            </div>

            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            style={{
              flex: 1,
              padding: "22px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              background: "var(--bg-base)",
            }}
          >
            {loadingCampaign && (
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: "13px",
                  alignSelf: "center",
                  marginTop: "32px",
                }}
              >
                Loading research campaign…
              </div>
            )}
            {loadError && (
              <div
                style={{
                  color: "var(--danger)",
                  fontSize: "13px",
                  alignSelf: "center",
                  marginTop: "32px",
                }}
              >
                {loadError}
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`chat-row ${message.role === "user" ? "chat-row-user" : ""}`}
              >
                {message.role === "assistant" && (
                  <div className="chat-avatar">AI</div>
                )}
                <div
                  className={`chat-bubble ${
                    message.role === "user"
                      ? "chat-bubble-user"
                      : "chat-bubble-assistant"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="chat-row">
                <div className="chat-avatar">AI</div>
                <div className="typing-indicator" aria-label="AI is thinking">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}

            {errorMsg && (
              <div
                style={{
                  alignSelf: "stretch",
                  fontSize: "13px",
                  color: "#991b1b",
                  background: "var(--danger-light)",
                  border: "1px solid var(--danger)",
                  padding: "8px 10px",
                  borderRadius: "10px",
                }}
              >
                {errorMsg}
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            ref={formRef}
            onSubmit={handleSend}
            style={{
              padding: "14px 22px 18px",
              borderTop: "1px solid var(--border)",
              background: "var(--bg-surface)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {advanceLabel && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className={
                    phase === "S4_FEEDBACK_2" ? "btn btn-primary" : "btn btn-secondary"
                  }
                  onClick={handleAdvance}
                  disabled={isThinking || isFinalizing}
                  style={{ padding: "8px 16px", fontSize: "13px" }}
                >
                  {isFinalizing && phase === "S4_FEEDBACK_2" && (
                    <span className="spinner" />
                  )}
                  {advanceLabel}
                </button>
              </div>
            )}

            <div className="composer-shell">
              <textarea
                ref={textareaRef}
                className="composer-textarea"
                rows={1}
                placeholder={composerPlaceholder}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={onTextareaKeyDown}
                disabled={composerDisabled}
              />
              <button
                type="submit"
                className="icon-btn"
                disabled={!canSend}
                aria-label="Send message"
              >
                {isThinking ? <span className="spinner" /> : <SendIcon />}
              </button>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "11.5px",
                color: "var(--text-muted)",
              }}
            >
              <span>
                <span className="kbd">Enter</span> to send &middot;{" "}
                <span className="kbd">Shift</span>+<span className="kbd">Enter</span>{" "}
                for new line
              </span>
              {isInterviewPhase(phase) && (
                <span>
                  Question {Math.min(questionsAskedRef.current, MAX_QUESTIONS)} /{" "}
                  {MAX_QUESTIONS}
                </span>
              )}
            </div>
          </form>
        </section>
      </div>

      {/* Finalize overlay */}
      {isFinalizing && (
        <div className="overlay-backdrop" role="status" aria-live="polite">
          <div
            className="card animate-scale-in"
            style={{
              padding: "32px 36px",
              textAlign: "center",
              maxWidth: "360px",
              width: "calc(100% - 48px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div className="soundwave">
              <span className="soundwave-bar" />
              <span className="soundwave-bar" />
              <span className="soundwave-bar" />
              <span className="soundwave-bar" />
              <span className="soundwave-bar" />
              <span className="soundwave-bar" />
              <span className="soundwave-bar" />
            </div>
            <div
              style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}
            >
              Building your refined question bank
            </div>
            <div className="text-secondary" style={{ lineHeight: 1.5 }}>
              Synthesizing both interviews and your feedback into improved
              questions and themes…
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CampaignFollowupPage() {
  return (
    <Suspense
      fallback={
        <div
          className="animate-fade-in"
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
          }}
        >
          Loading…
        </div>
      }
    >
      <CampaignFollowupPageContent />
    </Suspense>
  );
}
