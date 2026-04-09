"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { seedDatabase } from "@/lib/seed";

const statusConfig: Record<string, { label: string; className: string }> = {
  "active": { label: "Active", className: "badge-success" },
  "completed": { label: "Completed", className: "badge-info" },
  "scheduled": { label: "Scheduled", className: "badge-warning" },
  "paused": { label: "Paused", className: "badge-neutral" },
};

function formatTimeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) return hours <= 1 ? "Just now" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function DashboardOverview() {
  const [profile, setProfile] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardInfo = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: p } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      const { data: c } = await supabase.from("campaigns").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false });
      
      setProfile(p);
      setCampaigns(c || []);

      if (c && c.length > 0) {
        const campaignIds = c.map((camp: any) => camp.id);
        const { data: clls } = await supabase.from("calls").select("*, campaigns(name)").in("campaign_id", campaignIds).order("created_at", { ascending: false });
        setCalls(clls || []);
      }
      setLoading(false);
    };

    fetchDashboardInfo();
  }, []);

  const handleSeed = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await seedDatabase(session.user.id);
  };

  const activeCampaignsCount = campaigns.filter(c => c.status === "active").length;
  const inProgressCallsCount = calls.filter(c => c.status === "in-progress").length;
  const totalCallsToday = calls.length;

  const stats = [
    {
      label: "Active Campaigns",
      value: activeCampaignsCount.toString(),
      change: "+2 this week",
      changeType: "positive",
      icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
      color: "var(--primary-dark)",
      bg: "var(--primary-light)",
    },
    {
      label: "Interviews Today",
      value: totalCallsToday.toString(),
      change: `${inProgressCallsCount} in progress`,
      changeType: "active",
      icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
      color: "#1E40AF",
      bg: "var(--info-light)",
    },
    {
      label: "Transcripts",
      value: calls.filter(c => c.status === "completed").length.toString(),
      change: "+23 this week",
      changeType: "positive",
      icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
      color: "#92400E",
      bg: "var(--warning-light)",
    },
    {
      label: "Avg. Duration",
      value: "12m",
      change: "Across all calls",
      changeType: "neutral",
      icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
      color: "var(--text-secondary)",
      bg: "var(--bg-muted)",
    },
  ];

  if (loading) return null;

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
            Good afternoon, {profile?.full_name?.split(" ")[0] || "Researcher"}
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-secondary)" }}>
            Here&apos;s what&apos;s happening across your campaigns today.
          </p>
        </div>
        {campaigns.length === 0 && (
          <button className="btn btn-primary" onClick={handleSeed}>
            Seed Demo Data
          </button>
        )}
      </div>

      <div className="stagger-children" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px", marginBottom: "32px" }}>
        {stats.map((s) => (
          <div key={s.label} className="card card-interactive" style={{ padding: "24px" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "var(--radius-md)", background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={s.icon} />
              </svg>
            </div>
            <div style={{ fontSize: "32px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>{s.value}</div>
            <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>{s.label}</div>
            <div style={{ fontSize: "12px", fontWeight: 500, color: s.changeType === "positive" ? "#065F46" : s.changeType === "active" ? "var(--primary-dark)" : "var(--text-muted)" }}>
              {s.changeType === "active" && <span className="status-dot status-dot-active" style={{ display: "inline-block", marginRight: "6px", verticalAlign: "middle" }} />}
              {s.change}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "24px" }}>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>Recent Campaigns</h2>
            <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: "13px" }}>View all</button>
          </div>
          {campaigns.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>No campaigns available. Create one to get started!</div>
          ) : (
            campaigns.slice(0, 5).map((c, i) => (
              <div key={c.id} style={{
                display: "flex", alignItems: "center", gap: "16px", padding: "16px 24px",
                borderBottom: i < campaigns.length - 1 ? "1px solid var(--border-light)" : "none",
                cursor: "pointer", transition: "background 150ms ease",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>{c.name}</div>
                  <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>{formatTimeAgo(c.created_at)}</div>
                </div>
                <div style={{ textAlign: "right", marginRight: "12px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>{c.target_completed}/{c.participants_count}</div>
                  <div style={{ width: "80px", height: "4px", borderRadius: "var(--radius-full)", background: "var(--bg-muted)", marginTop: "6px", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${(c.target_completed / Math.max(c.participants_count, 1)) * 100}%`,
                      borderRadius: "var(--radius-full)",
                      background: c.status === "completed" ? "var(--success)" : "var(--primary)",
                      transition: "width 600ms ease",
                    }} />
                  </div>
                </div>
                <span className={`badge ${statusConfig[c.status]?.className || 'badge-neutral'}`}>{statusConfig[c.status]?.label || c.status}</span>
              </div>
            ))
          )}
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {(inProgressCallsCount > 0) && <span className="status-dot status-dot-active" />}
              <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>Live Calls</h2>
            </div>
            <span className={inProgressCallsCount > 0 ? "badge badge-success" : "badge badge-neutral"} style={{ fontSize: "12px" }}>
              {inProgressCallsCount} active
            </span>
          </div>
          {calls.filter(c => c.status === "in-progress").map((call: any, i, arr) => (
            <div key={call.id} style={{ padding: "16px 24px", borderBottom: i < arr.length - 1 ? "1px solid var(--border-light)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "50%",
                    background: "var(--primary-light)", color: "var(--primary-dark)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "12px", fontWeight: 700,
                  }}>
                    {call.participant_name.split(" ").map((n: string) => n[0]).join("")}
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{call.participant_name}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{call.campaigns?.name}</div>
                  </div>
                </div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--primary-dark)", fontVariantNumeric: "tabular-nums" }}>{formatDuration(call.duration_seconds)}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "2px", height: "24px", paddingLeft: "42px" }}>
                {Array.from({ length: 20 }).map((_, j) => (
                  <div key={j} style={{ width: "3px", height: `${Math.random() * 16 + 4}px`, borderRadius: "2px", background: "var(--primary)", opacity: 0.25 + Math.random() * 0.35 }} />
                ))}
              </div>
            </div>
          ))}
          {inProgressCallsCount === 0 && (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
              No live calls right now.
            </div>
          )}
          <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-light)", textAlign: "center" }}>
            <button className="btn btn-ghost" style={{ fontSize: "13px", padding: "6px 12px", color: "var(--primary-dark)" }}>
              View all calls
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
