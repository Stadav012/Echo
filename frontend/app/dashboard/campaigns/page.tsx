"use client";

import { useState } from "react";

const campaigns = [
  {
    id: "1",
    name: "User Onboarding Study",
    description: "Understanding pain points in the first-time user experience for mobile app onboarding",
    status: "active",
    participants: 48,
    completed: 31,
    failed: 2,
    avgDuration: "14m 23s",
    createdAt: "Apr 6, 2026",
    scheduledAt: "Apr 7, 2026 09:00",
    questions: 8,
  },
  {
    id: "2",
    name: "Product Satisfaction Q2",
    description: "Quarterly customer satisfaction interviews for enterprise clients",
    status: "active",
    participants: 120,
    completed: 87,
    failed: 5,
    avgDuration: "11m 50s",
    createdAt: "Apr 3, 2026",
    scheduledAt: "Apr 4, 2026 10:00",
    questions: 12,
  },
  {
    id: "3",
    name: "Feature Prioritization",
    description: "Gathering user preferences on upcoming feature roadmap items",
    status: "completed",
    participants: 35,
    completed: 35,
    failed: 0,
    avgDuration: "9m 12s",
    createdAt: "Mar 28, 2026",
    scheduledAt: "Mar 29, 2026 11:00",
    questions: 6,
  },
  {
    id: "4",
    name: "Accessibility Feedback",
    description: "Interviews with users who rely on assistive technologies",
    status: "scheduled",
    participants: 60,
    completed: 0,
    failed: 0,
    avgDuration: "-",
    createdAt: "Apr 8, 2026",
    scheduledAt: "Apr 12, 2026 08:00",
    questions: 10,
  },
  {
    id: "5",
    name: "Competitor Analysis Interviews",
    description: "Understanding why users switched from competing products",
    status: "paused",
    participants: 25,
    completed: 12,
    failed: 1,
    avgDuration: "16m 05s",
    createdAt: "Mar 20, 2026",
    scheduledAt: "Mar 21, 2026 14:00",
    questions: 15,
  },
];

const statusConfig: Record<string, { label: string; className: string; dotClass: string }> = {
  active: { label: "Active", className: "badge-success", dotClass: "status-dot-active" },
  completed: { label: "Completed", className: "badge-info", dotClass: "" },
  scheduled: { label: "Scheduled", className: "badge-warning", dotClass: "status-dot-pending" },
  paused: { label: "Paused", className: "badge-neutral", dotClass: "" },
};

export default function CampaignsPage() {
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? campaigns : campaigns.filter((c) => c.status === filter);

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
            Campaigns
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-secondary)" }}>
            Manage and monitor all your research interview campaigns
          </p>
        </div>
        <button className="btn btn-primary" style={{ padding: "10px 24px", fontSize: "14px" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Campaign
        </button>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "24px",
        }}
      >
        {[
          { value: "all", label: "All", count: campaigns.length },
          { value: "active", label: "Active", count: campaigns.filter((c) => c.status === "active").length },
          { value: "scheduled", label: "Scheduled", count: campaigns.filter((c) => c.status === "scheduled").length },
          { value: "completed", label: "Completed", count: campaigns.filter((c) => c.status === "completed").length },
          { value: "paused", label: "Paused", count: campaigns.filter((c) => c.status === "paused").length },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-full)",
              fontSize: "13px",
              fontWeight: 500,
              border: "1.5px solid",
              borderColor: filter === f.value ? "var(--primary)" : "var(--border)",
              background: filter === f.value ? "var(--primary-subtle)" : "var(--bg-surface)",
              color: filter === f.value ? "var(--primary)" : "var(--text-secondary)",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 150ms ease",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {f.label}
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                opacity: 0.7,
              }}
            >
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Campaign cards */}
      <div className="stagger-children" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {filtered.map((campaign) => {
          const progress = campaign.participants > 0 ? (campaign.completed / campaign.participants) * 100 : 0;
          return (
            <div
              key={campaign.id}
              className="card card-interactive"
              style={{ padding: "24px", cursor: "pointer" }}
            >
              <div style={{ display: "flex", gap: "20px" }}>
                {/* Main info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                    <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {campaign.name}
                    </h3>
                    <span className={`badge ${statusConfig[campaign.status]?.className}`}>
                      {statusConfig[campaign.status]?.dotClass && (
                        <span className={`status-dot ${statusConfig[campaign.status]?.dotClass}`} />
                      )}
                      {statusConfig[campaign.status]?.label}
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
                        label: `${campaign.participants} participants`,
                      },
                      {
                        icon: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
                        label: `${campaign.questions} questions`,
                      },
                      {
                        icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
                        label: `Avg. ${campaign.avgDuration}`,
                      },
                      {
                        icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
                        label: campaign.createdAt,
                      },
                    ].map(({ icon, label }) => (
                      <div
                        key={label}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "13px",
                          color: "var(--text-muted)",
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d={icon} />
                        </svg>
                        {label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Progress ring */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    minWidth: "100px",
                  }}
                >
                  <div style={{ position: "relative", width: "72px", height: "72px" }}>
                    <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: "rotate(-90deg)" }}>
                      <circle cx="36" cy="36" r="30" fill="none" stroke="var(--bg-muted)" strokeWidth="6" />
                      <circle
                        cx="36"
                        cy="36"
                        r="30"
                        fill="none"
                        stroke={campaign.status === "completed" ? "var(--success)" : "var(--primary)"}
                        strokeWidth="6"
                        strokeDasharray={`${2 * Math.PI * 30}`}
                        strokeDashoffset={`${2 * Math.PI * 30 * (1 - progress / 100)}`}
                        strokeLinecap="round"
                        style={{ transition: "stroke-dashoffset 800ms ease" }}
                      />
                    </svg>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "16px",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      {Math.round(progress)}%
                    </div>
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {campaign.completed}/{campaign.participants}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
