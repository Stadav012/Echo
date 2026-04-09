"use client";

const metrics = [
  { label: "Total Interviews", value: "142", change: "+18%", positive: true },
  { label: "Completion Rate", value: "92.4%", change: "+3.2%", positive: true },
  { label: "Avg. Duration", value: "12m 18s", change: "-0:45s", positive: true },
  { label: "No-Show Rate", value: "4.2%", change: "-1.1%", positive: true },
  { label: "Retry Success", value: "78%", change: "+5%", positive: true },
  { label: "Consent Rate", value: "99.3%", change: "+0.1%", positive: true },
];

const campaignPerformance = [
  { name: "User Onboarding Study", completion: 65, avgDuration: 14, sentiment: 72, responseRate: 88 },
  { name: "Product Satisfaction Q2", completion: 73, avgDuration: 12, sentiment: 85, responseRate: 92 },
  { name: "Feature Prioritization", completion: 100, avgDuration: 9, sentiment: 68, responseRate: 95 },
  { name: "Competitor Analysis", completion: 48, avgDuration: 16, sentiment: 55, responseRate: 76 },
];

const weeklyData = [
  { day: "Mon", calls: 12, completed: 11 },
  { day: "Tue", calls: 18, completed: 16 },
  { day: "Wed", calls: 15, completed: 14 },
  { day: "Thu", calls: 22, completed: 20 },
  { day: "Fri", calls: 28, completed: 25 },
  { day: "Sat", calls: 8, completed: 8 },
  { day: "Sun", calls: 5, completed: 4 },
];

const sentimentBreakdown = [
  { label: "Positive", value: 58, color: "var(--success)" },
  { label: "Neutral", value: 30, color: "var(--warning)" },
  { label: "Negative", value: 12, color: "var(--danger)" },
];

export default function AnalyticsPage() {
  const maxCalls = Math.max(...weeklyData.map((d) => d.calls));

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

      {/* Metric cards */}
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
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: m.positive ? "#065F46" : "#991B1B",
                }}
              >
                {m.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px", marginBottom: "32px" }}>
        {/* Weekly call volume chart */}
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
                  {/* Total calls bar */}
                  <div
                    style={{
                      width: "16px",
                      height: `${(d.calls / maxCalls) * 160}px`,
                      borderRadius: "4px 4px 0 0",
                      background: "var(--primary-light)",
                      transition: "height 600ms ease",
                    }}
                  />
                  {/* Completed bar */}
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

        {/* Sentiment breakdown */}
        <div className="card" style={{ padding: "24px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "24px" }}>
            Sentiment Breakdown
          </h2>
          {/* Donut chart visual */}
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
                <span style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" }}>142</span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>total</span>
              </div>
            </div>
          </div>
          {/* Legend */}
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

      {/* Campaign performance table */}
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
