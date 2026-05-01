"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type TranscriptRow = {
  id: string;
  sentiment: "positive" | "neutral" | "negative" | null;
  excerpt: string | null;
  full_text: string | null;
  questions_count: number | null;
  created_at: string;
};

type CallRow = {
  id: string;
  participant_name: string | null;
  duration_seconds: number | null;
  created_at: string;
  research_campaigns?: { title: string | null } | null;
  transcripts: TranscriptRow[] | null;
};

type TranscriptItem = {
  id: string;
  participant: string;
  campaign: string;
  date: string;
  dateIso: string;
  duration: string;
  questions: number;
  sentiment: "positive" | "neutral" | "negative" | "unknown";
  excerpt: string;
};

const sentimentConfig: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  positive: { label: "Positive", color: "#065F46", bg: "var(--success-light)" },
  neutral: { label: "Neutral", color: "#92400E", bg: "var(--warning-light)" },
  negative: { label: "Negative", color: "#991B1B", bg: "var(--danger-light)" },
  unknown: { label: "Unknown", color: "var(--text-secondary)", bg: "var(--bg-muted)" },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TranscriptsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth/login");
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("calls")
        .select(
          "id, participant_name, duration_seconds, created_at, research_campaigns(title), transcripts(id, sentiment, excerpt, full_text, questions_count, created_at)"
        )
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError(fetchError.message || "Failed to load transcripts.");
        setLoading(false);
        return;
      }

      const rows = (data as CallRow[] | null) ?? [];
      const mapped: TranscriptItem[] = [];

      for (const call of rows) {
        const callTranscripts = call.transcripts ?? [];
        for (const t of callTranscripts) {
          const excerpt =
            t.excerpt?.trim() ||
            t.full_text?.trim().slice(0, 220) ||
            "No excerpt available.";
          mapped.push({
            id: t.id,
            participant: (call.participant_name || "Unknown Participant").trim(),
            campaign: call.research_campaigns?.title?.trim() || "Untitled Campaign",
            dateIso: t.created_at || call.created_at,
            date: fmtDate(t.created_at || call.created_at),
            duration: fmtDuration(call.duration_seconds ?? 0),
            questions: t.questions_count ?? 0,
            sentiment: t.sentiment ?? "unknown",
            excerpt,
          });
        }
      }

      setTranscripts(mapped);
      setLoading(false);
    };

    void load();
  }, [router]);

  const campaigns = useMemo(
    () => [...new Set(transcripts.map((t) => t.campaign))],
    [transcripts]
  );

  const filtered = transcripts.filter((t) => {
    const matchesSearch =
      search === "" ||
      t.participant.toLowerCase().includes(search.toLowerCase()) ||
      t.excerpt.toLowerCase().includes(search.toLowerCase());
    const matchesCampaign =
      campaignFilter === "all" || t.campaign === campaignFilter;
    return matchesSearch && matchesCampaign;
  });

  const exportAll = () => {
    if (filtered.length === 0) return;
    const csvRows = [
      ["participant", "campaign", "date", "duration", "questions", "sentiment", "excerpt"],
      ...filtered.map((t) => [
        t.participant,
        t.campaign,
        t.dateIso,
        t.duration,
        String(t.questions),
        t.sentiment,
        t.excerpt.replace(/\s+/g, " "),
      ]),
    ];
    const csv = csvRows
      .map((row) =>
        row
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcripts.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

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
          <h1
            style={{
              fontSize: "26px",
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: "6px",
            }}
          >
            Transcripts
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-secondary)" }}>
            Browse, search, and export completed interview transcripts
          </p>
        </div>
        <button
          className="btn btn-secondary"
          style={{ padding: "10px 20px", fontSize: "14px" }}
          onClick={exportAll}
          disabled={filtered.length === 0}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
            }}
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
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Results count */}
      <div
        style={{
          fontSize: "13px",
          color: "var(--text-muted)",
          marginBottom: "16px",
        }}
      >
        Showing {filtered.length} of {transcripts.length} transcripts
      </div>

      {loading && (
        <div className="card" style={{ padding: "20px 24px" }}>
          <span style={{ color: "var(--text-secondary)" }}>Loading transcripts…</span>
        </div>
      )}

      {!loading && error && (
        <div className="card" style={{ padding: "20px 24px", borderColor: "var(--danger)" }}>
          <span style={{ color: "#991B1B" }}>{error}</span>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="card" style={{ padding: "20px 24px" }}>
          <span style={{ color: "var(--text-secondary)" }}>
            No transcripts found for the current filters.
          </span>
        </div>
      )}

      {/* Transcript list */}
      <div
        className="stagger-children"
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
      >
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
                {transcript.participant
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
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
                  <span
                    style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {transcript.participant}
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      padding: "2px 10px",
                      borderRadius: "var(--radius-full)",
                      background: sentimentConfig[transcript.sentiment]?.bg ?? sentimentConfig.unknown.bg,
                      color: sentimentConfig[transcript.sentiment]?.color ?? sentimentConfig.unknown.color,
                    }}
                  >
                    {sentimentConfig[transcript.sentiment]?.label ?? sentimentConfig.unknown.label}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--text-muted)",
                    marginBottom: "10px",
                  }}
                >
                  {transcript.campaign}
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
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
                <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  {transcript.date}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12,6 12,12 16,14" />
                  </svg>
                  {transcript.duration}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
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
