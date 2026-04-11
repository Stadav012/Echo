"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ResearchCampaignModal from "@/app/new_compaign/create_compaign/ResearchCampaignModal";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Campaign {
  id: string;
  title: string;
  description: string;
  status: string;
  campaign_id: string | null;
  contact_list_file_name: string;
  timeline_start: string;
  timeline_end: string;
  created_at: string;
}

interface CallStats {
  total: number;
  completed: number;
  avgDurationSeconds: number;
}

// ── Status config ─────────────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; className: string; dotClass: string }> = {
  active:    { label: "Active",    className: "badge-success", dotClass: "status-dot-active"   },
  completed: { label: "Completed", className: "badge-info",    dotClass: ""                    },
  scheduled: { label: "Scheduled", className: "badge-warning", dotClass: "status-dot-pending"  },
  paused:    { label: "Paused",    className: "badge-neutral", dotClass: ""                    },
  draft:     { label: "Draft",     className: "badge-neutral", dotClass: ""                    },
  archived:  { label: "Archived",  className: "badge-neutral", dotClass: ""                    },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDuration(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div style={{
      borderRadius: 12, border: "1px solid var(--border,#e5e7eb)",
      padding: 24, background: "var(--bg-surface,#fff)",
    }}>
      <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
      {[200, 140, 80].map((w, i) => (
        <div key={i} style={{
          height: i === 0 ? 18 : 14, width: `${w}px`, borderRadius: 6, marginBottom: 10,
          background: "linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%)",
          backgroundSize: "200% 100%", animation: "shimmer 1.5s ease-in-out infinite",
        }} />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CampaignsPage() {
  const router = useRouter();

  const [campaigns,  setCampaigns]  = useState<Campaign[]>([]);
  const [callStats,  setCallStats]  = useState<Record<string, CallStats>>({});
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState("all");
  const [isCreateCampaignOpen, setIsCreateCampaignOpen] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/login"); return; }

      const { data, error } = await supabase
        .from("research_campaigns")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error || !data) { setLoading(false); return; }
      setCampaigns(data);

      // Fetch call stats for each campaign that has a campaign_id
      const stats: Record<string, CallStats> = {};
      await Promise.all(
        data
          .filter((c: Campaign) => c.campaign_id)
          .map(async (c: Campaign) => {
            const { data: calls } = await supabase
              .from("calls")
              .select("id, status, duration_seconds")
              .eq("campaign_id", c.campaign_id!);

            const total     = calls?.length ?? 0;
            const completed = calls?.filter(cl => cl.status === "completed").length ?? 0;
            const totalSecs = calls?.reduce((sum, cl) => sum + (cl.duration_seconds ?? 0), 0) ?? 0;
            const avgSecs   = completed > 0 ? Math.round(totalSecs / completed) : 0;

            stats[c.id] = { total, completed, avgDurationSeconds: avgSecs };
          })
      );
      setCallStats(stats);
      setLoading(false);
    };
    load();
  }, [router]);

  // Re-fetch after modal closes (new campaign created)
  const handleModalClose = async () => {
    setIsCreateCampaignOpen(false);
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("research_campaigns")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    setCampaigns(data ?? []);
    setLoading(false);
  };

  const filtered = filter === "all" ? campaigns : campaigns.filter(c => c.status === filter);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
            Campaigns
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-secondary)" }}>
            Manage and monitor all your research interview campaigns
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ padding: "10px 24px", fontSize: "14px" }}
          onClick={() => setIsCreateCampaignOpen(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Campaign
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
        {[
          { value: "all",       label: "All",       count: campaigns.length },
          { value: "active",    label: "Active",    count: campaigns.filter(c => c.status === "active").length },
          { value: "scheduled", label: "Scheduled", count: campaigns.filter(c => c.status === "scheduled").length },
          { value: "completed", label: "Completed", count: campaigns.filter(c => c.status === "completed").length },
          { value: "paused",    label: "Paused",    count: campaigns.filter(c => c.status === "paused").length },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: "8px 16px", borderRadius: "var(--radius-full)", fontSize: "13px", fontWeight: 500,
              border: "1.5px solid", borderColor: filter === f.value ? "var(--primary)" : "var(--border)",
              background: filter === f.value ? "var(--primary-subtle)" : "var(--bg-surface)",
              color: filter === f.value ? "var(--primary)" : "var(--text-secondary)",
              cursor: "pointer", fontFamily: "inherit", transition: "all 150ms ease",
              display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            {f.label}
            <span style={{ fontSize: "11px", fontWeight: 700, opacity: 0.7 }}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Campaign cards */}
      <div className="stagger-children" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {loading ? (
          [1, 2, 3].map(i => <CardSkeleton key={i} />)
        ) : filtered.length === 0 ? (
          <div style={{
            padding: "56px 32px", textAlign: "center",
            background: "var(--bg-surface,#fff)", border: "1px solid var(--border,#e5e7eb)", borderRadius: 12,
          }}>
            <p style={{ fontSize: 15, fontWeight: 500, color: "var(--text-secondary)", margin: "0 0 4px" }}>
              {campaigns.length === 0 ? "No campaigns yet" : "No campaigns match this filter"}
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 20px" }}>
              {campaigns.length === 0
                ? "Create your first research campaign to get started."
                : "Try selecting a different filter above."}
            </p>
            {campaigns.length === 0 && (
              <button
                className="btn btn-primary"
                style={{ padding: "10px 24px", fontSize: "14px" }}
                onClick={() => setIsCreateCampaignOpen(true)}
              >
                + New Campaign
              </button>
            )}
          </div>
        ) : (
          filtered.map(campaign => {
            const stats    = callStats[campaign.id] ?? { total: 0, completed: 0, avgDurationSeconds: 0 };
            const progress = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

            return (
              <div
                key={campaign.id}
                className="card card-interactive"
                style={{ padding: "24px", cursor: "pointer" }}
                onClick={() => router.push(`/dashboard/research/${campaign.id}`)}
              >
                <div style={{ display: "flex", gap: "20px" }}>
                  {/* Main info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {campaign.title}
                      </h3>
                      <span className={`badge ${statusConfig[campaign.status]?.className ?? "badge-neutral"}`}>
                        {statusConfig[campaign.status]?.dotClass && (
                          <span className={`status-dot ${statusConfig[campaign.status]?.dotClass}`} />
                        )}
                        {statusConfig[campaign.status]?.label ?? campaign.status}
                      </span>
                    </div>
                    <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "20px", lineHeight: 1.5 }}>
                      {campaign.description}
                    </p>

                    {/* Meta row */}
                    <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                      {[
                        {
                          icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
                          label: `${stats.total} calls`,
                        },
                        {
                          icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
                          label: `${stats.completed} completed`,
                        },
                        {
                          icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
                          label: stats.avgDurationSeconds > 0 ? `Avg. ${fmtDuration(stats.avgDurationSeconds)}` : "No calls yet",
                        },
                        {
                          icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
                          label: fmtDate(campaign.created_at),
                        },
                      ].map(({ icon, label }) => (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d={icon} />
                          </svg>
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Progress ring */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", minWidth: "100px" }}>
                    <div style={{ position: "relative", width: "72px", height: "72px" }}>
                      <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: "rotate(-90deg)" }}>
                        <circle cx="36" cy="36" r="30" fill="none" stroke="var(--bg-muted)" strokeWidth="6" />
                        <circle
                          cx="36" cy="36" r="30" fill="none"
                          stroke={campaign.status === "completed" ? "var(--success)" : "var(--primary)"}
                          strokeWidth="6"
                          strokeDasharray={`${2 * Math.PI * 30}`}
                          strokeDashoffset={`${2 * Math.PI * 30 * (1 - progress / 100)}`}
                          strokeLinecap="round"
                          style={{ transition: "stroke-dashoffset 800ms ease" }}
                        />
                      </svg>
                      <div style={{
                        position: "absolute", inset: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "16px", fontWeight: 700, color: "var(--text-primary)",
                      }}>
                        {Math.round(progress)}%
                      </div>
                    </div>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {stats.completed}/{stats.total}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ResearchCampaignModal
        isOpen={isCreateCampaignOpen}
        onClose={handleModalClose}
      />
    </div>
  );
}
