"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    const finish = async () => {
      const code = new URLSearchParams(window.location.search).get("code");

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }

      // Apply role chosen on the register page before the OAuth redirect
      const pendingRole = localStorage.getItem("pending_google_role");
      if (pendingRole) {
        localStorage.removeItem("pending_google_role");
        const {
          data: { user },
        } = await supabase.auth.getUser();
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
