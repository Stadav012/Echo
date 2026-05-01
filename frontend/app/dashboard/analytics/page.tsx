"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CampaignRow = {
  id: string;
  title: string | null;
};

type CallRow = {
  id: string;
  research_campaign_id: string | null;
  status: string | null;
  duration_seconds: number | null;
  created_at: string;
  transcripts: TranscriptRow[] | null;
};

type TranscriptRow = {
  sentiment: "positive" | "neutral" | "negative" | null;
  excerpt?: string | null;
  full_text?: string | null;
};

type CampaignPerf = {
  id: string;
  name: string;
  completion: number;
  avgDuration: number;
  sentiment: number;
  responseRate: number;
};

type WeeklyDatum = {
  day: string;
  calls: number;
  completed: number;
};

type SentimentDatum = {
  label: string;
  value: number;
  color: string;
};

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function fmtAvgDuration(seconds: number): string {
  if (!seconds) return "0m 00s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function inferSentimentFromText(
  text: string | null | undefined
): "positive" | "neutral" | "negative" | null {
  const normalized = (text || "").trim().toLowerCase();
  if (!normalized) return null;
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
    if (normalized.includes(word)) score += 1;
  }
  for (const word of negativeWords) {
    if (normalized.includes(word)) score -= 1;
  }

  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalInterviews, setTotalInterviews] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);
  const [avgDurationSeconds, setAvgDurationSeconds] = useState(0);
  const [noShowRate, setNoShowRate] = useState(0);
  const [retrySuccessRate, setRetrySuccessRate] = useState(0);
  const [consentRate, setConsentRate] = useState(0);
  const [campaignPerformance, setCampaignPerformance] = useState<CampaignPerf[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyDatum[]>([
    { day: "Mon", calls: 0, completed: 0 },
    { day: "Tue", calls: 0, completed: 0 },
    { day: "Wed", calls: 0, completed: 0 },
    { day: "Thu", calls: 0, completed: 0 },
    { day: "Fri", calls: 0, completed: 0 },
    { day: "Sat", calls: 0, completed: 0 },
    { day: "Sun", calls: 0, completed: 0 },
  ]);
  const [sentimentBreakdown, setSentimentBreakdown] = useState<SentimentDatum[]>([
    { label: "Positive", value: 0, color: "var(--success)" },
    { label: "Neutral", value: 0, color: "var(--warning)" },
    { label: "Negative", value: 0, color: "var(--danger)" },
  ]);

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

      const { data: campaignsData, error: campaignsError } = await supabase
        .from("research_campaigns")
        .select("id, title")
        .eq("user_id", session.user.id);

      if (campaignsError) {
        setError(campaignsError.message || "Failed to load campaigns.");
        setLoading(false);
        return;
      }

      const campaigns = (campaignsData as CampaignRow[] | null) ?? [];
      const campaignIds = campaigns.map((c) => c.id);
      const campaignTitleById = new Map(
        campaigns.map((c) => [c.id, c.title?.trim() || "Untitled Campaign"])
      );

      if (campaignIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: callsData, error: callsError } = await supabase
        .from("calls")
        .select(
          "id, research_campaign_id, status, duration_seconds, created_at, transcripts(sentiment, excerpt, full_text)"
        )
        .in("research_campaign_id", campaignIds);

      if (callsError) {
        setError(callsError.message || "Failed to load calls.");
        setLoading(false);
        return;
      }

      const calls = (callsData as CallRow[] | null) ?? [];
      const transcripts = calls.flatMap((call) => call.transcripts ?? []);

      const total = calls.length;
      const completedCalls = calls.filter((c) => (c.status || "").toLowerCase() === "completed");
      const completedCount = completedCalls.length;
      const completion = total > 0 ? (completedCount / total) * 100 : 0;

      const completedDurationSum = completedCalls.reduce(
        (sum, c) => sum + (c.duration_seconds ?? 0),
        0
      );
      const avgDuration = completedCount > 0 ? Math.round(completedDurationSum / completedCount) : 0;

      const noShowStatuses = new Set(["failed", "missed", "expired", "no-show", "no_show"]);
      const noShowCount = calls.filter((c) => noShowStatuses.has((c.status || "").toLowerCase())).length;
      const noShow = total > 0 ? (noShowCount / total) * 100 : 0;

      const retryStatuses = new Set(["retry_success", "retried_success", "recovered"]);
      const retryCalls = calls.filter((c) => {
        const st = (c.status || "").toLowerCase();
        return st.includes("retry") || retryStatuses.has(st);
      });
      const retrySuccessCount = retryCalls.filter((c) => {
        const st = (c.status || "").toLowerCase();
        return st.includes("success") || st === "completed";
      }).length;
      const retrySuccess = retryCalls.length > 0 ? (retrySuccessCount / retryCalls.length) * 100 : 0;

      const callsWithTranscript = calls.filter((c) => (c.transcripts ?? []).length > 0).length;
      const consent = total > 0 ? (callsWithTranscript / total) * 100 : 0;

      const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
      for (const t of transcripts) {
        const resolvedSentiment =
          t.sentiment ??
          inferSentimentFromText(t.full_text) ??
          inferSentimentFromText(t.excerpt);
        if (resolvedSentiment === "positive") sentimentCounts.positive += 1;
        if (resolvedSentiment === "neutral") sentimentCounts.neutral += 1;
        if (resolvedSentiment === "negative") sentimentCounts.negative += 1;
      }
      const sentimentTotal =
        sentimentCounts.positive + sentimentCounts.neutral + sentimentCounts.negative;
      const sentimentBreakdownComputed: SentimentDatum[] = [
        {
          label: "Positive",
          value:
            sentimentTotal > 0 ? Math.round((sentimentCounts.positive / sentimentTotal) * 100) : 0,
          color: "var(--success)",
        },
        {
          label: "Neutral",
          value:
            sentimentTotal > 0 ? Math.round((sentimentCounts.neutral / sentimentTotal) * 100) : 0,
          color: "var(--warning)",
        },
        {
          label: "Negative",
          value:
            sentimentTotal > 0 ? Math.round((sentimentCounts.negative / sentimentTotal) * 100) : 0,
          color: "var(--danger)",
        },
      ];

      const perfByCampaign = new Map<
        string,
        {
          total: number;
          completed: number;
          durationSum: number;
          transcripted: number;
          positive: number;
          neutral: number;
          negative: number;
        }
      >();

      for (const call of calls) {
        const cid = call.research_campaign_id || "unknown";
        const bucket =
          perfByCampaign.get(cid) ?? {
            total: 0,
            completed: 0,
            durationSum: 0,
            transcripted: 0,
            positive: 0,
            neutral: 0,
            negative: 0,
          };
        bucket.total += 1;
        if ((call.status || "").toLowerCase() === "completed") {
          bucket.completed += 1;
          bucket.durationSum += call.duration_seconds ?? 0;
        }
        const tx = call.transcripts ?? [];
        if (tx.length > 0) bucket.transcripted += 1;
        for (const t of tx) {
          const resolvedSentiment =
            t.sentiment ??
            inferSentimentFromText(t.full_text) ??
            inferSentimentFromText(t.excerpt);
          if (resolvedSentiment === "positive") bucket.positive += 1;
          if (resolvedSentiment === "neutral") bucket.neutral += 1;
          if (resolvedSentiment === "negative") bucket.negative += 1;
        }
        perfByCampaign.set(cid, bucket);
      }

      const campaignPerfComputed: CampaignPerf[] = Array.from(perfByCampaign.entries())
        .map(([campaignId, data]) => {
          const completionPct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
          const avgDur =
            data.completed > 0 ? Math.round(data.durationSum / data.completed / 60) : 0;
          const sentimentTotalForCampaign = data.positive + data.neutral + data.negative;
          const sentimentScore =
            sentimentTotalForCampaign > 0
              ? Math.round(
                  ((data.positive + data.neutral * 0.5) / sentimentTotalForCampaign) * 100
                )
              : 0;
          const responseRate =
            data.total > 0 ? Math.round((data.transcripted / data.total) * 100) : 0;
          return {
            id: campaignId,
            name: campaignTitleById.get(campaignId) || "Untitled Campaign",
            completion: completionPct,
            avgDuration: avgDur,
            sentiment: sentimentScore,
            responseRate,
          };
        })
        .sort((a, b) => b.completion - a.completion);

      const weekStart = startOfDay(new Date());
      weekStart.setDate(weekStart.getDate() - 6);
      const dayBuckets = new Map<string, { calls: number; completed: number }>();
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        dayBuckets.set(key, { calls: 0, completed: 0 });
      }
      for (const c of calls) {
        const key = new Date(c.created_at).toISOString().slice(0, 10);
        const bucket = dayBuckets.get(key);
        if (!bucket) continue;
        bucket.calls += 1;
        if ((c.status || "").toLowerCase() === "completed") {
          bucket.completed += 1;
        }
      }
      const weeklyComputed: WeeklyDatum[] = Array.from(dayBuckets.entries()).map(
        ([iso, counts]) => ({
          day: new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" }),
          calls: counts.calls,
          completed: counts.completed,
        })
      );

      setTotalInterviews(total);
      setCompletionRate(completion);
      setAvgDurationSeconds(avgDuration);
      setNoShowRate(noShow);
      setRetrySuccessRate(retrySuccess);
      setConsentRate(consent);
      setCampaignPerformance(campaignPerfComputed);
      setWeeklyData(weeklyComputed);
      setSentimentBreakdown(sentimentBreakdownComputed);
      setLoading(false);
    };

    void load();
  }, [router]);

  const metrics = useMemo(
    () => [
      { label: "Total Interviews", value: String(totalInterviews) },
      { label: "Completion Rate", value: pct(completionRate) },
      { label: "Avg. Duration", value: fmtAvgDuration(avgDurationSeconds) },
      { label: "No-Show Rate", value: pct(noShowRate) },
      { label: "Retry Success", value: pct(retrySuccessRate) },
      { label: "Consent Rate", value: pct(consentRate) },
    ],
    [
      totalInterviews,
      completionRate,
      avgDurationSeconds,
      noShowRate,
      retrySuccessRate,
      consentRate,
    ]
  );

  const maxCalls = Math.max(1, ...weeklyData.map((d) => d.calls));

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
          Analytics
        </h1>
        <p style={{ fontSize: "15px", color: "var(--text-secondary)" }}>
          Campaign performance metrics and insights across all your research
        </p>
      </div>

      {loading && (
        <div className="card" style={{ padding: "16px 20px", marginBottom: "20px" }}>
          Loading analytics…
        </div>
      )}

      {!loading && error && (
        <div
          className="card"
          style={{
            padding: "16px 20px",
            marginBottom: "20px",
            borderColor: "var(--danger)",
          }}
        >
          <span style={{ color: "#991B1B" }}>{error}</span>
        </div>
      )}

      <div
        className="stagger-children"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
          marginBottom: "32px",
        }}
      >
        {metrics.map((m) => (
          <div key={m.label} className="card" style={{ padding: "20px 24px" }}>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" }}>
              {m.label}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
              <span style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>
                {m.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px", marginBottom: "32px" }}>
        <div className="card" style={{ padding: "24px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "24px" }}>
            Weekly Call Volume
          </h2>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", height: "200px", paddingBottom: "8px" }}>
            {weeklyData.map((d) => (
              <div
                key={d.day}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                  height: "100%",
                  justifyContent: "flex-end",
                }}
              >
                <div style={{ position: "relative", width: "100%", display: "flex", gap: "4px", justifyContent: "center" }}>
                  <div
                    style={{
                      width: "16px",
                      height: `${(d.calls / maxCalls) * 160}px`,
                      borderRadius: "4px 4px 0 0",
                      background: "var(--primary-light)",
                      transition: "height 600ms ease",
                    }}
                  />
                  <div
                    style={{
                      width: "16px",
                      height: `${(d.completed / maxCalls) * 160}px`,
                      borderRadius: "4px 4px 0 0",
                      background: "var(--primary)",
                      transition: "height 600ms ease",
                    }}
                  />
                </div>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>
                  {d.day}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "24px", marginTop: "16px", justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
              <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: "var(--primary-light)" }} />
              Total Calls
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
              <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: "var(--primary)" }} />
              Completed
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: "24px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "24px" }}>
            Sentiment Breakdown
          </h2>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
            <div style={{ position: "relative", width: "140px", height: "140px" }}>
              <svg width="140" height="140" viewBox="0 0 140 140">
                {(() => {
                  let offset = 0;
                  const radius = 55;
                  const circumference = 2 * Math.PI * radius;
                  return sentimentBreakdown.map((s) => {
                    const dashLength = (s.value / 100) * circumference;
                    const el = (
                      <circle
                        key={s.label}
                        cx="70"
                        cy="70"
                        r={radius}
                        fill="none"
                        stroke={s.color}
                        strokeWidth="18"
                        strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                        strokeDashoffset={-offset}
                        style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "all 600ms ease" }}
                      />
                    );
                    offset += dashLength;
                    return el;
                  });
                })()}
              </svg>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" }}>
                  {totalInterviews}
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>total</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {sentimentBreakdown.map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: "13px", color: "var(--text-secondary)" }}>{s.label}</span>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{s.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-light)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>
            Campaign Performance
          </h2>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Campaign", "Completion", "Avg Duration", "Sentiment Score", "Response Rate"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "14px 24px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "1px solid var(--border-light)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaignPerformance.map((c, i) => (
                <tr
                  key={c.name}
                  style={{
                    borderBottom: i < campaignPerformance.length - 1 ? "1px solid var(--border-light)" : "none",
                    cursor: "pointer",
                    transition: "background 150ms ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-elevated)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <td style={{ padding: "16px 24px", fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>
                    {c.name}
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div
                        style={{
                          width: "80px",
                          height: "6px",
                          borderRadius: "var(--radius-full)",
                          background: "var(--bg-muted)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${c.completion}%`,
                            borderRadius: "var(--radius-full)",
                            background: c.completion === 100 ? "var(--success)" : "var(--primary)",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{c.completion}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "16px 24px", fontSize: "14px", color: "var(--text-secondary)" }}>
                    {c.avgDuration}m
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: c.sentiment >= 70 ? "#065F46" : c.sentiment >= 50 ? "#92400E" : "#991B1B",
                      }}
                    >
                      {c.sentiment}/100
                    </span>
                  </td>
                  <td style={{ padding: "16px 24px", fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>
                    {c.responseRate}%
                  </td>
                </tr>
              ))}
              {!loading && !error && campaignPerformance.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: "16px 24px",
                      fontSize: "14px",
                      color: "var(--text-muted)",
                    }}
                  >
                    No campaign analytics available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
