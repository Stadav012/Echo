"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function SoundWave({ className = "" }: { className?: string }) {
  return (
    <div className={`soundwave ${className}`}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="soundwave-bar" />
      ))}
    </div>
  );
}

type PageState = "loading" | "form" | "success" | "error";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const establish = async () => {
      const code = new URLSearchParams(window.location.search).get("code");

      if (code) {
        // PKCE flow: exchange the code for a session
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setErrorMsg(error.message);
          setPageState("error");
          return;
        }
      } else {
        // Implicit flow: supabase-js already parsed the hash fragment on init.
        // Give it one tick, then check whether a session was established.
        await new Promise((r) => setTimeout(r, 50));
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setPageState("error");
          return;
        }
      }

      setPageState("form");
    };
    establish();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      setPageState("success");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-base)",
      }}
    >
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
        }}
      >
        <div
          className="animate-fade-in"
          style={{
            width: "100%",
            maxWidth: "420px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <SoundWave />

          {pageState === "loading" && (
            <div
              style={{
                marginTop: "40px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  border: "3px solid var(--border)",
                  borderTopColor: "var(--primary)",
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                }}
              />
              <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
                Verifying your link…
              </p>
            </div>
          )}

          {pageState === "error" && (
            <div
              style={{
                marginTop: "40px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                Link expired or invalid
              </h2>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                }}
              >
                {errorMsg || "This reset link is no longer valid."}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => router.push("/auth/login")}
                style={{ marginTop: "8px", padding: "12px 32px" }}
              >
                Back to sign in
              </button>
            </div>
          )}

          {pageState === "success" && (
            <div
              style={{
                marginTop: "40px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "var(--primary-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                Password updated
              </h2>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                }}
              >
                Your new password is set. You can now sign in.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => router.push("/auth/login")}
                style={{ marginTop: "8px", padding: "12px 32px" }}
              >
                Go to sign in
              </button>
            </div>
          )}

          {pageState === "form" && (
            <>
              <h1
                style={{
                  fontSize: "28px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginTop: "32px",
                  marginBottom: "8px",
                  textAlign: "center",
                }}
              >
                Set new password
              </h1>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                  marginBottom: "36px",
                  textAlign: "center",
                }}
              >
                Choose a strong password for your account
              </p>

              <form
                onSubmit={handleSubmit}
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                }}
              >
                <div>
                  <label htmlFor="new-password" className="form-label">
                    New Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      className="input-base"
                      placeholder="Minimum 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoFocus
                      style={{ paddingRight: "48px" }}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: "14px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px",
                        color: "var(--text-muted)",
                        display: "flex",
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {showPassword ? (
                          <>
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </>
                        ) : (
                          <>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm-password" className="form-label">
                    Confirm Password
                  </label>
                  <input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    className="input-base"
                    placeholder="Repeat your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>

                {errorMsg && (
                  <div
                    style={{
                      color: "var(--danger)",
                      fontSize: "14px",
                      textAlign: "center",
                    }}
                  >
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "14px",
                    fontSize: "15px",
                    marginTop: "4px",
                  }}
                >
                  {loading ? (
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "spin 0.6s linear infinite",
                      }}
                    />
                  ) : (
                    "Update Password"
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </main>

      <footer
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 40px",
          borderTop: "1px solid var(--border-light)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div className="soundwave soundwave-sm soundwave-static">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="soundwave-bar" />
            ))}
          </div>
          <span
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Echo
          </span>
        </div>
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          &copy; 2026 Echo Research Lab
        </span>
        <div style={{ display: "flex", gap: "20px" }}>
          <span
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            Documentation
          </span>
          <span
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            Privacy
          </span>
        </div>
      </footer>

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
