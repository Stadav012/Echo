"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

const starterPrompts = [
  "Help me improve my interview questions for clarity.",
  "What context should I add to get better participant responses?",
  "Suggest follow-up questions based on my research goal.",
];

function generateAssistantReply(userText: string) {
  const normalized = userText.toLowerCase();
  if (normalized.includes("question")) {
    return "Great direction. I suggest splitting complex questions into one intent each, then adding one probing follow-up for every core question.";
  }
  if (normalized.includes("context") || normalized.includes("background")) {
    return "Add context in three layers: research objective, participant profile, and decision you want this research to influence.";
  }
  if (normalized.includes("timeline") || normalized.includes("schedule")) {
    return "For timeline quality, define milestones: pilot interviews, first review checkpoint, and final synthesis date.";
  }
  return "I can help refine this. Tell me your main objective, target participants, and what decisions this research should support.";
}

export default function CampaignFollowupPage() {
  const searchParams = useSearchParams();
  const researchId = searchParams.get("researchId");
  const researchTitle = searchParams.get("title") || "Untitled Research";

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "assistant-1",
      role: "assistant",
      text: `Nice work creating "${researchTitle}". I can help you refine your questions and strengthen your research context. What should we improve first?`,
    },
  ]);
  const [inputValue, setInputValue] = useState("");

  const canSend = inputValue.trim().length > 0;
  const titleInitials = useMemo(() => {
    return researchTitle
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "RC";
  }, [researchTitle]);

  const handleSend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now() + 1}`,
      role: "assistant",
      text: generateAssistantReply(trimmed),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInputValue("");
  };

  return (
    <div className="animate-fade-in" style={{ minHeight: "100vh", background: "var(--bg-base)", padding: "24px" }}>
      <div style={{ maxWidth: "980px", margin: "0 auto", display: "grid", gridTemplateColumns: "280px 1fr", gap: "18px" }}>
        <aside className="card" style={{ padding: "20px", height: "fit-content" }}>
          <Link href="/dashboard/campaigns" className="btn btn-ghost" style={{ padding: "6px 10px", marginBottom: "14px" }}>
            Back to Campaigns
          </Link>
          <div style={{ width: "44px", height: "44px", borderRadius: "var(--radius-md)", background: "var(--primary-light)", color: "var(--primary-dark)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, marginBottom: "12px" }}>
            {titleInitials}
          </div>
          <h1 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
            AI Research Refinement
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "10px", lineHeight: 1.5 }}>
            Use this chat to improve your question bank and clarify research context before running interviews.
          </p>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6 }}>
            <div><strong>Title:</strong> {researchTitle}</div>
            {researchId && <div><strong>ID:</strong> {researchId}</div>}
          </div>
        </aside>

        <section className="card" style={{ padding: "0", display: "flex", flexDirection: "column", minHeight: "76vh" }}>
          <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>Refine with AI Chat</h2>
          </div>

          <div style={{ padding: "14px 18px", display: "flex", gap: "8px", flexWrap: "wrap", borderBottom: "1px solid var(--border-light)" }}>
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: "12px", padding: "7px 10px" }}
                onClick={() => setInputValue(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, padding: "18px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", background: "var(--bg-input)" }}>
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "78%",
                  background: message.role === "user" ? "var(--primary)" : "var(--bg-surface)",
                  color: message.role === "user" ? "var(--text-inverse)" : "var(--text-primary)",
                  border: message.role === "user" ? "none" : "1px solid var(--border)",
                  borderRadius: "14px",
                  padding: "10px 12px",
                  fontSize: "14px",
                  lineHeight: 1.5,
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                {message.text}
              </div>
            ))}
          </div>

          <form onSubmit={handleSend} style={{ padding: "14px", borderTop: "1px solid var(--border)", display: "flex", gap: "10px", background: "var(--bg-surface)" }}>
            <input
              className="input-base"
              placeholder="Ask AI to refine your research..."
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={!canSend}>
              Send
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
