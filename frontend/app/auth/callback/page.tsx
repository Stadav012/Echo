"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function SoundWave() {
  return (
    <div className="soundwave">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="soundwave-bar" />
      ))}
    </div>
  );
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const finish = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const errorParam = params.get("error");
      const errorDescription = params.get("error_description");

      if (errorParam) {
        console.error("OAuth error:", errorParam, errorDescription);
        router.replace(`/auth/login?error=${encodeURIComponent(errorDescription ?? errorParam)}`);
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error("exchangeCodeForSession failed:", error.message);
          router.replace(`/auth/login?error=${encodeURIComponent(error.message)}`);
          return;
        }
      } else {
        // Implicit flow — tokens arrive in the URL hash; Supabase parses them automatically.
        // Wait briefly for the client to process the hash before checking the session.
        await new Promise((r) => setTimeout(r, 100));
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.replace("/auth/login?error=no_session");
          return;
        }
      }

      // Apply role chosen on the register page before the OAuth redirect
      const pendingRole = localStorage.getItem("pending_google_role");
      if (pendingRole) {
        localStorage.removeItem("pending_google_role");
        const { data: { user } } = await supabase.auth.getUser();
        if (user && !user.user_metadata?.role) {
          await supabase.auth.updateUser({ data: { role: pendingRole } });
        }
      }

      router.replace("/dashboard");
    };

    finish();
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
        background: "var(--bg-base)",
      }}
    >
      <SoundWave />
      <div
        style={{
          width: "28px",
          height: "28px",
          border: "3px solid var(--border)",
          borderTopColor: "var(--primary)",
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
          marginTop: "8px",
        }}
      />
      <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
        Signing you in…
      </p>
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
