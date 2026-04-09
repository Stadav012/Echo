"use client";

const activeCalls = [
  {
    id: "c1",
    participant: "Sarah Mitchell",
    phone: "+1 (555) 234-5678",
    campaign: "User Onboarding Study",
    status: "in-progress",
    duration: "4:23",
    currentQuestion: "What was your first impression of the app?",
    questionIndex: 3,
    totalQuestions: 8,
    consent: true,
  },
  {
    id: "c2",
    participant: "James Kim",
    phone: "+1 (555) 345-6789",
    campaign: "User Onboarding Study",
    status: "in-progress",
    duration: "2:10",
    currentQuestion: "Can you describe any challenges you faced during sign-up?",
    questionIndex: 2,
    totalQuestions: 8,
    consent: true,
  },
  {
    id: "c3",
    participant: "Maria López",
    phone: "+44 7911 123456",
    campaign: "Product Satisfaction Q2",
    status: "in-progress",
    duration: "8:45",
    currentQuestion: "How would you rate your overall experience with our support team?",
    questionIndex: 7,
    totalQuestions: 12,
    consent: true,
  },
];

const pendingCalls = [
  { participant: "Ahmed Hassan", phone: "+1 (555) 456-7890", campaign: "User Onboarding Study", scheduledFor: "2:30 PM", status: "pending" },
  { participant: "Lisa Chen", phone: "+1 (555) 567-8901", campaign: "User Onboarding Study", scheduledFor: "2:45 PM", status: "pending" },
  { participant: "Tom Wilson", phone: "+44 7700 900000", campaign: "Product Satisfaction Q2", scheduledFor: "3:00 PM", status: "pending" },
  { participant: "Priya Sharma", phone: "+91 98765 43210", campaign: "Product Satisfaction Q2", scheduledFor: "3:15 PM", status: "ringing" },
];

const recentCompleted = [
  { participant: "David Brown", campaign: "User Onboarding Study", duration: "12:34", completedAt: "1:45 PM", status: "completed" },
  { participant: "Emma Taylor", campaign: "Product Satisfaction Q2", duration: "9:22", completedAt: "1:30 PM", status: "completed" },
  { participant: "Robert Chen", campaign: "User Onboarding Study", duration: "15:01", completedAt: "1:15 PM", status: "completed" },
  { participant: "Ana García", campaign: "Product Satisfaction Q2", duration: "-", completedAt: "12:58 PM", status: "failed" },
];

export default function LiveCallsPage() {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
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

      {/* Active calls */}
      <div className="stagger-children" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "20px", marginBottom: "32px" }}>
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
            {/* Call header */}
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
                  {call.participant.split(" ").map((n) => n[0]).join("")}
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
                <span className="status-dot status-dot-active" />
                {call.duration}
              </div>
            </div>

            {/* Call body */}
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>
                Campaign: {call.campaign}
              </div>

              {/* Current question */}
              <div
                style={{
                  padding: "12px 16px",
                  background: "var(--bg-base)",
                  borderRadius: "var(--radius-sm)",
                  marginBottom: "16px",
                  borderLeft: "3px solid var(--primary)",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--primary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Current Question ({call.questionIndex}/{call.totalQuestions})
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.5 }}>
                  {call.currentQuestion}
                </div>
              </div>

              {/* Progress */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    flex: 1,
                    height: "6px",
                    borderRadius: "var(--radius-full)",
                    background: "var(--bg-muted)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(call.questionIndex / call.totalQuestions) * 100}%`,
                      borderRadius: "var(--radius-full)",
                      background: "var(--primary)",
                      transition: "width 600ms ease",
                    }}
                  />
                </div>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  {Math.round((call.questionIndex / call.totalQuestions) * 100)}%
                </span>
              </div>

              {/* Audio waveform */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "2px",
                  height: "28px",
                  marginTop: "16px",
                  justifyContent: "center",
                }}
              >
                {Array.from({ length: 32 }).map((_, j) => {
                  const h = Math.random() * 20 + 4;
                  return (
                    <div
                      key={j}
                      style={{
                        width: "3px",
                        height: `${h}px`,
                        borderRadius: "2px",
                        background: "var(--primary)",
                        opacity: 0.2 + Math.random() * 0.5,
                        transition: "height 300ms ease",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Two column: Pending + Recent */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Pending */}
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
          {pendingCalls.map((call, i) => (
            <div
              key={call.participant}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px 24px",
                borderBottom: i < pendingCalls.length - 1 ? "1px solid var(--border-light)" : "none",
              }}
            >
              <span
                className={`status-dot ${call.status === "ringing" ? "status-dot-active" : "status-dot-pending"}`}
              />
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
              <span className={`badge ${call.status === "ringing" ? "badge-success" : "badge-warning"}`}>
                {call.status === "ringing" ? "Ringing" : "Pending"}
              </span>
            </div>
          ))}
        </div>

        {/* Recently completed */}
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
          {recentCompleted.map((call, i) => (
            <div
              key={call.participant}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px 24px",
                borderBottom: i < recentCompleted.length - 1 ? "1px solid var(--border-light)" : "none",
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
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
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
