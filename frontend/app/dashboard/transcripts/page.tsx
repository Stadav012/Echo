"use client";

import { useState } from "react";

const transcripts = [
  {
    id: "t1",
    participant: "Sarah Mitchell",
    campaign: "User Onboarding Study",
    date: "Apr 8, 2026",
    duration: "14:23",
    questions: 8,
    sentiment: "positive",
    excerpt: "I really enjoyed the step-by-step walkthrough. It made the whole process feel intuitive and I didn't need to look for help at any point...",
  },
  {
    id: "t2",
    participant: "James Kim",
    campaign: "User Onboarding Study",
    date: "Apr 8, 2026",
    duration: "11:05",
    questions: 8,
    sentiment: "neutral",
    excerpt: "The sign-up was straightforward, but I wasn't sure what to do after creating my account. The dashboard felt a bit overwhelming at first...",
  },
  {
    id: "t3",
    participant: "Maria López",
    campaign: "Product Satisfaction Q2",
    date: "Apr 7, 2026",
    duration: "16:50",
    questions: 12,
    sentiment: "positive",
    excerpt: "Your support team has been amazing. Every time I reach out, I get a response within an hour and they always resolve my issues quickly...",
  },
  {
    id: "t4",
    participant: "David Brown",
    campaign: "User Onboarding Study",
    date: "Apr 7, 2026",
    duration: "12:34",
    questions: 8,
    sentiment: "negative",
    excerpt: "I had trouble connecting my external accounts. The integration page kept failing silently without any error messages, which was frustrating...",
  },
  {
    id: "t5",
    participant: "Emma Taylor",
    campaign: "Product Satisfaction Q2",
    date: "Apr 7, 2026",
    duration: "9:22",
    questions: 12,
    sentiment: "positive",
    excerpt: "The new analytics dashboard is exactly what we needed. Being able to see real-time metrics has significantly improved our decision-making...",
  },
  {
    id: "t6",
    participant: "Robert Chen",
    campaign: "Feature Prioritization",
    date: "Apr 5, 2026",
    duration: "15:01",
    questions: 6,
    sentiment: "neutral",
    excerpt: "I think the collaboration features should be the top priority. We use the product mainly for team projects and better sharing would help a lot...",
  },
];

const sentimentConfig: Record<string, { label: string; color: string; bg: string }> = {
  positive: { label: "Positive", color: "#065F46", bg: "var(--success-light)" },
  neutral: { label: "Neutral", color: "#92400E", bg: "var(--warning-light)" },
  negative: { label: "Negative", color: "#991B1B", bg: "var(--danger-light)" },
};

export default function TranscriptsPage() {
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");

  const campaigns = [...new Set(transcripts.map((t) => t.campaign))];

  const filtered = transcripts.filter((t) => {
    const matchesSearch =
      search === "" ||
      t.participant.toLowerCase().includes(search.toLowerCase()) ||
      t.excerpt.toLowerCase().includes(search.toLowerCase());
    const matchesCampaign = campaignFilter === "all" || t.campaign === campaignFilter;
    return matchesSearch && matchesCampaign;
  });

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "28px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
            Transcripts
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-secondary)" }}>
            Browse, search, and export completed interview transcripts
          </p>
        </div>
        <button className="btn btn-secondary" style={{ padding: "10px 20px", fontSize: "14px" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Export All
        </button>
      </div>

      {/* Search & filters */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="input-base"
            placeholder="Search transcripts by participant or content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: "42px" }}
          />
        </div>
        <select
          className="input-base"
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
          style={{ width: "240px", cursor: "pointer" }}
        >
          <option value="all">All Campaigns</option>
          {campaigns.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Results count */}
      <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>
        Showing {filtered.length} of {transcripts.length} transcripts
      </div>

      {/* Transcript list */}
      <div className="stagger-children" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {filtered.map((transcript) => (
          <div
            key={transcript.id}
            className="card card-interactive"
            style={{ padding: "20px 24px", cursor: "pointer" }}
          >
            <div style={{ display: "flex", gap: "16px" }}>
              {/* Avatar */}
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "var(--primary-light)",
                  color: "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {transcript.participant.split(" ").map((n) => n[0]).join("")}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "6px",
                  }}
                >
                  <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>
                    {transcript.participant}
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      padding: "2px 10px",
                      borderRadius: "var(--radius-full)",
                      background: sentimentConfig[transcript.sentiment].bg,
                      color: sentimentConfig[transcript.sentiment].color,
                    }}
                  >
                    {sentimentConfig[transcript.sentiment].label}
                  </span>
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "10px" }}>
                  {transcript.campaign}
                </div>
                <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                  &ldquo;{transcript.excerpt}&rdquo;
                </p>
              </div>

              {/* Meta */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: "8px",
                  flexShrink: 0,
                }}
              >
                <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>{transcript.date}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "var(--text-secondary)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12,6 12,12 16,14" />
                  </svg>
                  {transcript.duration}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "var(--text-secondary)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {transcript.questions}q
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
