import Link from "next/link";

function SoundWave() {
  return (
    <div className="soundwave" style={{ height: "56px" }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="soundwave-bar" />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-base)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle decorative blobs */}
      <div style={{ position: "absolute", top: "-200px", right: "-100px", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(45, 212, 160, 0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-150px", left: "-50px", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(96, 165, 250, 0.05) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 40px", position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="soundwave soundwave-sm soundwave-static">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="soundwave-bar" />
            ))}
          </div>
          <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>Echo</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/auth/login" className="btn btn-ghost" style={{ padding: "10px 20px", fontSize: "14px" }}>Sign In</Link>
          <Link href="/auth/register" className="btn btn-primary" style={{ padding: "10px 24px", fontSize: "14px" }}>Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 40px 80px", textAlign: "center", position: "relative", zIndex: 10 }}>
        <div className="animate-fade-in" style={{ maxWidth: "680px" }}>
          <SoundWave />

          <h1 style={{
            fontSize: "clamp(40px, 5.5vw, 60px)", fontWeight: 800, lineHeight: 1.1,
            color: "var(--text-primary)", margin: "32px 0 20px", letterSpacing: "-0.02em",
          }}>
            Automate your{" "}
            <span style={{ color: "var(--primary-dark)" }}>research interviews</span>
          </h1>

          <p style={{ fontSize: "18px", lineHeight: 1.7, color: "var(--text-secondary)", marginBottom: "40px", maxWidth: "520px", marginLeft: "auto", marginRight: "auto" }}>
            Echo conducts qualitative interviews via AI-powered phone calls.
            Upload participants, define questions, and let Echo handle the rest.
          </p>

          <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/auth/register" className="btn btn-primary" style={{ padding: "14px 32px", fontSize: "16px", borderRadius: "var(--radius-lg)" }}>
              Start Free Campaign
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link href="/auth/login" className="btn btn-secondary" style={{ padding: "14px 32px", fontSize: "16px", borderRadius: "var(--radius-lg)" }}>Sign In</Link>
          </div>
        </div>

        {/* Feature pills */}
        <div className="stagger-children" style={{ display: "flex", gap: "32px", marginTop: "72px", flexWrap: "wrap", justifyContent: "center" }}>
          {[
            { label: "AI Phone Calls", icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" },
            { label: "Live Transcription", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
            { label: "Smart Analytics", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
            { label: "GDPR Compliant", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
          ].map(({ icon, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-secondary)", fontSize: "14px", fontWeight: 500 }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "var(--radius-sm)", background: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-dark)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={icon} />
                </svg>
              </div>
              {label}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
