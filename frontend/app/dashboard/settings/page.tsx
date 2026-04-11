"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Profile {
  id: string;
  full_name: string;
  role: "researcher" | "product" | "compliance";
  company?: string | null;
  timezone?: string | null;
}

type SaveState = "idle" | "saving" | "saved" | "error";

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name: string, email: string) {
  if (name?.trim())
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

// ── Save Button ───────────────────────────────────────────────────────────────
function SaveButton({
  state,
  onClick,
}: {
  state: SaveState;
  onClick: () => void;
}) {
  const map: Record<SaveState, { label: string; style: React.CSSProperties }> =
    {
      idle: { label: "Save Changes", style: {} },
      saving: { label: "Saving…", style: { opacity: 0.7 } },
      saved: {
        label: "✓ Saved",
        style: { background: "var(--success)", color: "#fff" },
      },
      error: {
        label: "Retry",
        style: {
          background: "var(--danger-light)",
          color: "#991B1B",
          borderColor: "var(--danger)",
        },
      },
    };
  const s = map[state];
  return (
    <button
      onClick={onClick}
      disabled={state === "saving"}
      className="btn btn-primary"
      style={{ padding: "10px 22px", fontSize: 14, ...s.style }}
    >
      {s.label}
    </button>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: "var(--radius-full)",
        background: checked ? "var(--primary)" : "var(--border)",
        border: "none",
        cursor: "pointer",
        position: "relative",
        flexShrink: 0,
        transition: "background var(--transition-fast)",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left var(--transition-fast)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
        }}
      />
    </button>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────────
function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div
        style={{
          padding: "18px 24px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-elevated)",
        }}
      >
        <h2
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          {title}
        </h2>
        {description && (
          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              margin: "3px 0 0",
            }}
          >
            {description}
          </p>
        )}
      </div>
      <div style={{ padding: "24px" }}>{children}</div>
    </div>
  );
}

// ── Field Row ─────────────────────────────────────────────────────────────────
function Field({
  label,
  hint,
  last,
  children,
}: {
  label: string;
  hint?: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        gap: "8px 24px",
        alignItems: "start",
        paddingBottom: last ? 0 : 20,
        marginBottom: last ? 0 : 20,
        borderBottom: last ? "none" : "1px solid var(--border-light)",
      }}
    >
      <div style={{ paddingTop: 2 }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--text-primary)",
            margin: "0 0 2px",
          }}
        >
          {label}
        </p>
        {hint && (
          <p
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {hint}
          </p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
      {[80, 380, 260, 180, 120].map((h, i) => (
        <div
          key={i}
          style={{
            height: h,
            borderRadius: "var(--radius-lg)",
            background:
              "linear-gradient(90deg,var(--bg-muted) 25%,var(--border) 50%,var(--bg-muted) 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ROLE_OPTIONS = [
  { value: "researcher", label: "Researcher" },
  { value: "product", label: "Product Manager" },
  { value: "compliance", label: "Compliance Officer" },
];

const TIMEZONES = [
  "Africa/Accra",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Cairo",
  "Africa/Casablanca",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  // Profile
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Profile["role"]>("researcher");
  const [company, setCompany] = useState("");
  const [timezone, setTimezone] = useState("Africa/Accra");
  const [profileSave, setProfileSave] = useState<SaveState>("idle");

  // Password
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdSave, setPwdSave] = useState<SaveState>("idle");
  const [pwdError, setPwdError] = useState("");

  // Notifications
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [callSummaries, setCallSummaries] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [prefSave, setPrefSave] = useState<SaveState>("idle");

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/auth/login");
        return;
      }

      const user = session.user;
      setEmail(user.email ?? "");

      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (prof) {
        setProfile(prof);
        setFullName(prof.full_name ?? "");
        setRole(prof.role ?? "researcher");
        setCompany(prof.company ?? user.user_metadata?.company ?? "");
        setTimezone(
          prof.timezone ?? user.user_metadata?.timezone ?? "Africa/Accra"
        );
      }

      const meta = user.user_metadata ?? {};
      setEmailNotifs(meta.pref_email_notifs ?? true);
      setCallSummaries(meta.pref_call_summaries ?? true);
      setWeeklyDigest(meta.pref_weekly_digest ?? false);

      setLoading(false);
    };

    load();
  }, [router]);

  // ── Save profile ───────────────────────────────────────────────────────────
  const saveProfile = async () => {
    if (!profile) return;
    setProfileSave("saving");

    const { error: dbErr } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        role,
        company: company || null,
        timezone: timezone || null,
      })
      .eq("id", profile.id);

    const { error: authErr } = await supabase.auth.updateUser({
      data: { full_name: fullName, role, company, timezone },
    });

    if (dbErr && authErr) {
      setProfileSave("error");
      setTimeout(() => setProfileSave("idle"), 3000);
    } else {
      setProfile((p) =>
        p ? { ...p, full_name: fullName, role, company, timezone } : p
      );
      setProfileSave("saved");
      setTimeout(() => setProfileSave("idle"), 2500);
    }
  };

  // ── Save password ──────────────────────────────────────────────────────────
  const savePassword = async () => {
    setPwdError("");

    if (!newPwd) {
      setPwdError("New password is required.");
      return;
    }

    if (newPwd.length < 8) {
      setPwdError("Password must be at least 8 characters.");
      return;
    }

    if (newPwd !== confirmPwd) {
      setPwdError("Passwords do not match.");
      return;
    }

    setPwdSave("saving");
    const { error } = await supabase.auth.updateUser({ password: newPwd });

    if (error) {
      setPwdError(error.message);
      setPwdSave("error");
      setTimeout(() => setPwdSave("idle"), 3000);
    } else {
      setNewPwd("");
      setConfirmPwd("");
      setPwdSave("saved");
      setTimeout(() => setPwdSave("idle"), 2500);
    }
  };

  // ── Save preferences ───────────────────────────────────────────────────────
  const savePreferences = async () => {
    setPrefSave("saving");

    const { error } = await supabase.auth.updateUser({
      data: {
        pref_email_notifs: emailNotifs,
        pref_call_summaries: callSummaries,
        pref_weekly_digest: weeklyDigest,
      },
    });

    if (error) {
      setPrefSave("error");
      setTimeout(() => setPrefSave("idle"), 3000);
    } else {
      setPrefSave("saved");
      setTimeout(() => setPrefSave("idle"), 2500);
    }
  };

  // ── Sign out ───────────────────────────────────────────────────────────────
  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="animate-fade-in" style={{ padding: 8 }}>
        <Skeleton />
      </div>
    );
  }

  return (
    <div
      className="animate-fade-in"
      style={{
        maxWidth: 760,
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: "0 0 6px",
          }}
        >
          Settings
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-secondary)", margin: 0 }}>
          Manage your account information and preferences
        </p>
      </div>

      <SectionCard
        title="Profile"
        description="Update your personal information"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            paddingBottom: 24,
            marginBottom: 24,
            borderBottom: "1px solid var(--border-light)",
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: "var(--primary-light)",
              color: "var(--primary-text)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 700,
              flexShrink: 0,
              border: "2px solid var(--primary)",
            }}
          >
            {getInitials(fullName, email)}
          </div>
          <div>
            <p
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: "0 0 2px",
              }}
            >
              {fullName || "No name set"}
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              {email}
            </p>
            <span
              className="badge badge-neutral"
              style={{ marginTop: 6, fontSize: 11 }}
            >
              {ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role}
            </span>
          </div>
        </div>

        <Field label="Full Name" hint="Your display name across the platform">
          <input
            className="input-base"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Nzu Sikhosana"
          />
        </Field>

        <Field
          label="Email Address"
          hint="Contact support to change your email"
        >
          <input
            className="input-base"
            value={email}
            disabled
            style={{ cursor: "not-allowed", opacity: 0.6 }}
          />
        </Field>

        <Field label="Role" hint="Your role determines your access level">
          <select
            className="input-base"
            value={role}
            onChange={(e) => setRole(e.target.value as Profile["role"])}
            style={{ cursor: "pointer" }}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Company" hint="Optional — shown on your profile">
          <input
            className="input-base"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Ashesi University"
          />
        </Field>

        <Field
          label="Timezone"
          hint="Used to schedule calls at the right local time"
          last
        >
          <select
            className="input-base"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            style={{ cursor: "pointer" }}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </Field>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 20,
            paddingTop: 20,
            borderTop: "1px solid var(--border-light)",
          }}
        >
          <SaveButton state={profileSave} onClick={saveProfile} />
        </div>
      </SectionCard>

      <SectionCard title="Password" description="Update your account password">
        <Field label="New Password" hint="Minimum 8 characters">
          <input
            className="input-base"
            type="password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            placeholder="Enter new password"
          />
        </Field>

        <Field label="Confirm Password" last>
          <input
            className="input-base"
            type="password"
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            placeholder="Confirm new password"
          />
        </Field>

        {pwdError && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              marginTop: 12,
              background: "var(--danger-light)",
              border: "1px solid var(--danger)",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
              color: "#991B1B",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4m0 4h.01" />
            </svg>
            {pwdError}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 20,
            paddingTop: 20,
            borderTop: "1px solid var(--border-light)",
          }}
        >
          <SaveButton state={pwdSave} onClick={savePassword} />
        </div>
      </SectionCard>

      <SectionCard
        title="Notifications"
        description="Control when and how you receive updates"
      >
        {[
          {
            id: "notif-email",
            label: "Email Notifications",
            hint: "Receive email updates about your campaigns and calls",
            value: emailNotifs,
            set: setEmailNotifs,
          },
          {
            id: "notif-calls",
            label: "Call Summaries",
            hint: "Get a summary email after each research call completes",
            value: callSummaries,
            set: setCallSummaries,
          },
          {
            id: "notif-digest",
            label: "Weekly Digest",
            hint: "A weekly overview of campaign progress and insights",
            value: weeklyDigest,
            set: setWeeklyDigest,
          },
        ].map(({ id, label, hint, value, set }, i, arr) => (
          <div
            key={id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: i < arr.length - 1 ? 20 : 0,
              marginBottom: i < arr.length - 1 ? 20 : 0,
              borderBottom:
                i < arr.length - 1 ? "1px solid var(--border-light)" : "none",
            }}
          >
            <label htmlFor={id} style={{ cursor: "pointer", flex: 1 }}>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  margin: "0 0 2px",
                }}
              >
                {label}
              </p>
              <p
                style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}
              >
                {hint}
              </p>
            </label>
            <Toggle id={id} checked={value} onChange={set} />
          </div>
        ))}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 20,
            paddingTop: 20,
            borderTop: "1px solid var(--border-light)",
          }}
        >
          <SaveButton state={prefSave} onClick={savePreferences} />
        </div>
      </SectionCard>

      <SectionCard title="Account">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <p
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "var(--text-primary)",
                margin: "0 0 2px",
              }}
            >
              Sign Out
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
              Sign out of your Echo account on this device
            </p>
          </div>
          <button
            onClick={signOut}
            className="btn btn-secondary"
            style={{ padding: "9px 20px", fontSize: 14 }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--danger-light)";
              e.currentTarget.style.color = "#991B1B";
              e.currentTarget.style.borderColor = "var(--danger)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "";
              e.currentTarget.style.color = "";
              e.currentTarget.style.borderColor = "";
            }}
          >
            Sign Out
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
