"use client";

import Link from "next/link";
import { useState } from "react";
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

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("researcher");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role: role,
        },
      },
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
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
            Create your account
          </h1>
          <p
            style={{
              fontSize: "15px",
              color: "var(--text-secondary)",
              marginBottom: "36px",
              textAlign: "center",
            }}
          >
            Launch your first AI research campaign in minutes
          </p>

          {/* Google signup */}
          <button
            className="btn btn-secondary"
            style={{ width: "100%", padding: "14px", fontSize: "15px", marginBottom: "28px" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <div className="divider-text" style={{ width: "100%", marginBottom: "28px" }}>
            <span>or</span>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{ width: "100%", display: "flex", flexDirection: "column", gap: "18px" }}
          >
            <div>
              <label htmlFor="register-name" className="form-label">Full Name</label>
              <input
                id="register-name"
                type="text"
                className="input-base"
                placeholder="Dr. Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="register-email" className="form-label">Email Address</label>
              <input
                id="register-email"
                type="email"
                className="input-base"
                placeholder="name@institution.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="register-password" className="form-label">Password</label>
              <div style={{ position: "relative" }}>
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  className="input-base"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  style={{ paddingRight: "48px" }}
                />
                <button
                  type="button"
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
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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

            {/* Role selector */}
            <div>
              <label className="form-label">Your Role</label>
              <div style={{ display: "flex", gap: "10px" }}>
                {[
                  { value: "researcher", label: "Researcher" },
                  { value: "product", label: "Product / UX" },
                  { value: "compliance", label: "Compliance" },
                ].map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    style={{
                      flex: 1,
                      padding: "10px 8px",
                      borderRadius: "var(--radius-md)",
                      border: `1.5px solid ${role === r.value ? "var(--primary)" : "var(--border)"}`,
                      background: role === r.value ? "var(--primary-light)" : "var(--bg-surface)",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: "13px",
                      fontWeight: role === r.value ? 600 : 500,
                      color: role === r.value ? "var(--primary-text)" : "var(--text-secondary)",
                      transition: "all 150ms ease",
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {errorMsg && (
              <div style={{ color: "var(--danger)", fontSize: "14px", textAlign: "center" }}>
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: "100%", padding: "14px", fontSize: "15px", marginTop: "4px" }}
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
                "Create Account"
              )}
            </button>

            <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.6 }}>
              By creating an account, you agree to our Terms of Service and Privacy Policy
            </p>
          </form>

          <p
            style={{
              textAlign: "center",
              marginTop: "28px",
              fontSize: "14px",
              color: "var(--text-secondary)",
            }}
          >
            Already have an account?{" "}
            <Link
              href="/auth/login"
              style={{
                color: "var(--primary-dark)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Sign In
            </Link>
          </p>
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
          <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>Echo</span>
        </div>
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>&copy; 2026 Echo Research Lab</span>
        <div style={{ display: "flex", gap: "20px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", cursor: "pointer" }}>Documentation</span>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", cursor: "pointer" }}>Privacy</span>
        </div>
      </footer>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
