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
  participant_name: string | null;
  participant_phone: string | null;
  research_campaign_id: string | null;
  status: string | null;
  duration_seconds: number | null;
  current_question_index: number | null;
  created_at: string;
  scheduled_for: string | null;
  completed_at: string | null;
};

type LiveCall = {
  id: string;
  participant: string;
  phone: string;
  campaign: string;
  status: string;
  duration: string;
  currentQuestionIndex: number;
  scheduledFor: string;
  completedAt: string;
};

function fmtDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtElapsedSince(iso: string): string {
  const created = new Date(iso).getTime();
  const now = Date.now();
  if (Number.isNaN(created) || created >= now) return "0:00";
  return fmtDuration(Math.floor((now - created) / 1000));
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function LiveCallsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calls, setCalls] = useState<LiveCall[]>([]);

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
      const campaignNameById = new Map(
        campaigns.map((c) => [c.id, c.title?.trim() || "Untitled Campaign"])
      );

      const campaignIds = campaigns.map((c) => c.id);
      if (campaignIds.length === 0) {
        setCalls([]);
        setLoading(false);
        return;
      }

      const { data: callsData, error: callsError } = await supabase
        .from("calls")
        .select(
          "id, participant_name, participant_phone, research_campaign_id, status, duration_seconds, current_question_index, created_at, scheduled_for, completed_at"
        )
        .in("research_campaign_id", campaignIds)
        .order("created_at", { ascending: false });

      if (callsError) {
        setError(callsError.message || "Failed to load calls.");
        setLoading(false);
        return;
      }

      const mapped = ((callsData as CallRow[] | null) ?? []).map((call) => {
        const status = (call.status || "unknown").toLowerCase();
        const duration =
          call.duration_seconds && call.duration_seconds > 0
            ? fmtDuration(call.duration_seconds)
            : status === "active" || status === "in-progress" || status === "ringing"
              ? fmtElapsedSince(call.created_at)
              : "—";
        return {
          id: call.id,
          participant: (call.participant_name || "Unknown Participant").trim(),
          phone: call.participant_phone || "—",
          campaign:
            campaignNameById.get(call.research_campaign_id || "") ||
            "Untitled Campaign",
          status,
          duration,
          currentQuestionIndex: call.current_question_index ?? 0,
          scheduledFor: fmtTime(call.scheduled_for),
          completedAt: fmtTime(call.completed_at || call.created_at),
        } as LiveCall;
      });

      setCalls(mapped);
      setLoading(false);
    };

    void load();
  }, [router]);

  const activeCalls = useMemo(
    () => calls.filter((c) => ["active", "in-progress", "ringing"].includes(c.status)),
    [calls]
  );
  const pendingCalls = useMemo(
    () => calls.filter((c) => ["pending", "scheduled"].includes(c.status)),
    [calls]
  );
  const recentCompleted = useMemo(
    () =>
      calls.filter((c) =>
        ["completed", "failed", "missed", "expired"].includes(c.status)
      ),
    [calls]
  );

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: "28px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "6px",
          }}
        >
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: "var(--text-primary)" }}>
            Live Call Monitor
          </h1>
          <span className="badge badge-success" style={{ fontSize: "12px" }}>
            <span className="status-dot status-dot-active" />
            {activeCalls.length} active
          </span>
        </div>
        <p style={{ fontSize: "15px", color: "var(--text-secondary)" }}>
          Real-time view of all ongoing and queued interview calls
        </p>
      </div>

      {loading && (
        <div className="card" style={{ padding: "16px 20px", marginBottom: "20px" }}>
          Loading live calls…
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
          gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
          gap: "20px",
          marginBottom: "32px",
        }}
      >
        {!loading && !error && activeCalls.length === 0 && (
          <div className="card" style={{ padding: "16px 20px" }}>
            No active calls right now.
          </div>
        )}

        {activeCalls.map((call) => (
          <div
            key={call.id}
            className="card"
            style={{
              padding: "0",
              overflow: "hidden",
              border: "1.5px solid rgba(45, 212, 160, 0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                background: "var(--primary-light)",
                borderBottom: "1px solid rgba(45, 212, 160, 0.1)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--primary), var(--primary-hover))",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  {call.participant
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                    {call.participant}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {call.phone}
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--primary)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span
                  className={`status-dot ${
                    call.status === "ringing" ? "status-dot-pending" : "status-dot-active"
                  }`}
                />
                {call.duration}
              </div>
            </div>

            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>
                Campaign: {call.campaign}
              </div>

              <div
                style={{
                  padding: "12px 16px",
                  background: "var(--bg-base)",
                  borderRadius: "var(--radius-sm)",
                  marginBottom: "12px",
                  borderLeft: "3px solid var(--primary)",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--primary)",
                    marginBottom: "4px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Current position
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.5 }}>
                  {call.currentQuestionIndex > 0
                    ? `On question ${call.currentQuestionIndex}`
                    : "Interview started"}
                </div>
              </div>

              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Live call in progress
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <div className="card" style={{ padding: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "20px 24px",
              borderBottom: "1px solid var(--border-light)",
            }}
          >
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>
              Queue ({pendingCalls.length})
            </h2>
          </div>

          {!loading && !error && pendingCalls.length === 0 && (
            <div style={{ padding: "14px 24px", color: "var(--text-muted)", fontSize: "13px" }}>
              No queued calls.
            </div>
          )}

          {pendingCalls.map((call, i) => (
            <div
              key={call.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px 24px",
                borderBottom:
                  i < pendingCalls.length - 1 ? "1px solid var(--border-light)" : "none",
              }}
            >
              <span className="status-dot status-dot-pending" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>
                  {call.participant}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {call.campaign}
                </div>
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 500 }}>
                {call.scheduledFor}
              </div>
              <span className="badge badge-warning">Pending</span>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid var(--border-light)",
            }}
          >
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>
              Recently Completed
            </h2>
          </div>

          {!loading && !error && recentCompleted.length === 0 && (
            <div style={{ padding: "14px 24px", color: "var(--text-muted)", fontSize: "13px" }}>
              No completed/failed calls yet.
            </div>
          )}

          {recentCompleted.map((call, i) => (
            <div
              key={call.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px 24px",
                borderBottom:
                  i < recentCompleted.length - 1
                    ? "1px solid var(--border-light)"
                    : "none",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: call.status === "completed" ? "var(--success)" : "var(--danger)",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>
                  {call.participant}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {call.campaign}
                </div>
              </div>
              <div
                style={{
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                  fontWeight: 500,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {call.duration}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {call.completedAt}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
