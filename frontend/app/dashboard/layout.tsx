"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const navItems = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    exact: true,
  },
  {
    href: "/dashboard/campaigns",
    label: "Campaigns",
    icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
  },
  {
    href: "/dashboard/calls",
    label: "Live Calls",
    icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
    badge: 3,
  },
  {
    href: "/dashboard/transcripts",
    label: "Transcripts",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth/login");
        return;
      }
      setUser(session.user);
      
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
        
      if (profileData) {
        setProfile(profileData);
      }
    };
    fetchUser();
  }, [router]);

  if (!user) {
    return <div style={{ height: "100vh", background: "var(--bg-base)" }} />;
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Sidebar — light */}
      <aside
        style={{
          width: collapsed ? "72px" : "260px",
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--sidebar-border)",
          display: "flex",
          flexDirection: "column",
          transition: "width 250ms cubic-bezier(0.4, 0, 0.2, 1)",
          flexShrink: 0,
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 50,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: collapsed ? "20px 16px" : "20px 24px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            borderBottom: "1px solid var(--sidebar-border)",
          }}
        >
          <div className="soundwave soundwave-sm soundwave-static" style={{ flexShrink: 0 }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="soundwave-bar" />
            ))}
          </div>
          {!collapsed && (
            <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>Echo</span>
          )}
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: "2px" }}>
          {navItems.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: collapsed ? "12px" : "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: active ? "var(--sidebar-active)" : "transparent",
                  color: active ? "var(--primary-text)" : "var(--sidebar-text)",
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: active ? 600 : 500,
                  transition: "all 150ms ease",
                  justifyContent: collapsed ? "center" : "flex-start",
                  position: "relative",
                }}
                title={collapsed ? item.label : undefined}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "var(--sidebar-hover)";
                    e.currentTarget.style.color = "var(--sidebar-text-active)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--sidebar-text)";
                  }
                }}
              >
                {active && (
                  <div
                    style={{
                      position: "absolute",
                      left: "-12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "3px",
                      height: "20px",
                      borderRadius: "0 3px 3px 0",
                      background: "var(--primary)",
                    }}
                  />
                )}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d={item.icon} />
                </svg>
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && item.badge && (
                  <span style={{
                    marginLeft: "auto", background: "var(--primary)", color: "#fff",
                    fontSize: "11px", fontWeight: 700, padding: "2px 8px",
                    borderRadius: "var(--radius-full)", minWidth: "20px", textAlign: "center",
                  }}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div style={{ padding: "12px", borderTop: "1px solid var(--sidebar-border)" }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: collapsed ? "10px" : "10px 14px", borderRadius: "var(--radius-sm)",
              background: "transparent", color: "var(--sidebar-text)",
              border: "none", cursor: "pointer", fontSize: "13px", fontFamily: "inherit",
              width: "100%", justifyContent: collapsed ? "center" : "flex-start",
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0, transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 250ms ease" }}>
              <path d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
            </svg>
            {!collapsed && <span>Collapse</span>}
          </button>

          <div
            style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: collapsed ? "10px" : "10px 14px", borderRadius: "var(--radius-sm)",
              marginTop: "4px", justifyContent: collapsed ? "center" : "flex-start",
              cursor: "pointer", transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{
              width: "32px", height: "32px", borderRadius: "50%",
              background: "linear-gradient(135deg, var(--primary), var(--primary-hover))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "13px", fontWeight: 700, color: "#fff", flexShrink: 0,
            }}>
              DR
            </div>
            {!collapsed && (
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {profile?.full_name || "Researcher"}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user.email}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div style={{
        flex: 1, marginLeft: collapsed ? "72px" : "260px",
        transition: "margin-left 250ms cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex", flexDirection: "column", minHeight: "100vh",
      }}>
        {/* Top bar */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          padding: "16px 32px", borderBottom: "1px solid var(--border)",
          background: "var(--bg-surface)", gap: "16px", position: "sticky", top: 0, zIndex: 40,
        }}>
          <button 
            className="btn btn-ghost" 
            style={{ padding: "8px", borderRadius: "var(--radius-sm)", position: "relative" }}
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/auth/login");
            }}
            title="Sign Out"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
          <button className="btn btn-primary" style={{ padding: "8px 20px", fontSize: "13px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Campaign
          </button>
        </header>

        <main style={{ flex: 1, padding: "32px" }}>{children}</main>
      </div>
    </div>
  );
}
