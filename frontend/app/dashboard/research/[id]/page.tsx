"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────
interface RefinementSummary {
  improved_questions?: string[];
  key_themes?: string[];
  notes?: string;
  feedback_1?: string;
  feedback_2?: string;
  completed_at?: string;
}

interface ResearchCampaign {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: string;
  campaign_id: string | null;
  question_bank_mode: "text" | "file";
  question_bank_text: string | null;
  question_bank_file_name: string | null;
  contact_list_file_name: string;
  timeline_start: string;
  timeline_end: string;
  created_at: string;
  updated_at: string;
  refinement_summary: RefinementSummary | null;
}

interface Transcript {
  id: string;
  call_id: string;
  sentiment: "positive" | "neutral" | "negative" | null;
  excerpt: string | null;
  full_text: string | null;
  questions_count: number;
  created_at: string;
}

interface Call {
  id: string;
  participant_name: string;
  participant_phone: string | null;
  status: string;
  duration_seconds: number;
  scheduled_for: string | null;
  completed_at: string | null;
  current_question_index: number;
  created_at: string;
  transcripts: Transcript[];
}

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  age: string | null;
  occupation: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = {
  duration(s: number | null) {
    if (!s) return "—";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec.toString().padStart(2, "0")}s`;
  },
  date(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  },
};

// ── Badge ─────────────────────────────────────────────────────────────────────
const BADGE_CLASS: Record<string, string> = {
  completed:     "badge badge-success",
  active:        "badge badge-success",
  "in-progress": "badge badge-info",
  pending:       "badge badge-warning",
  ringing:       "badge badge-warning",
  scheduled:     "badge badge-warning",
  failed:        "badge badge-error",
  missed:        "badge badge-error",
  paused:        "badge badge-neutral",
  draft:         "badge badge-neutral",
  archived:      "badge badge-neutral",
  positive:      "badge badge-success",
  neutral:       "badge badge-warning",
  negative:      "badge badge-error",
};

const BADGE_LABEL: Record<string, string> = {
  "in-progress": "In Progress",
};

function Badge({ value }: { value: string | null }) {
  const key = (value ?? "unknown").toLowerCase();
  const cls = BADGE_CLASS[key] ?? "badge badge-neutral";
  const label = BADGE_LABEL[key] ?? (value ? value.charAt(0).toUpperCase() + value.slice(1) : "—");
  return <span className={cls}>{label}</span>;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      <div
        className="stat-value"
        style={{ color: accent ?? "var(--primary)", fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// ── Progress Ring ─────────────────────────────────────────────────────────────
function ProgressRing({ pct }: { pct: number }) {
  const r = 28, size = 72, circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={36} cy={36} r={r} fill="none" stroke="var(--bg-muted)" strokeWidth="6" />
      <circle
        cx={36} cy={36} r={r} fill="none"
        stroke="var(--primary)" strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 36 36)"
        style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)" }}
      />
      <text x="36" y="41" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text-primary)">
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "16px" }}>
      {[60, 120, 80, 320].map((h, i) => (
        <div key={i} className="skeleton" style={{ height: h, borderRadius: "var(--radius-lg)" }} />
      ))}
    </div>
  );
}

// ── Sentiment Bar ─────────────────────────────────────────────────────────────
function SentimentBar({ positive, neutral, negative, total }:
  { positive: number; neutral: number; negative: number; total: number }) {
  if (total === 0)
    return <div style={{ height: 10, borderRadius: "var(--radius-full)", background: "var(--bg-muted)" }} />;

  const pct = (n: number) => `${(n / total * 100).toFixed(1)}%`;
  return (
    <div>
      <div style={{ display: "flex", height: 10, borderRadius: "var(--radius-full)", overflow: "hidden", gap: 2 }}>
        <div style={{ width: pct(positive), background: "var(--success)" }} />
        <div style={{ width: pct(neutral),  background: "var(--warning)" }} />
        <div style={{ width: pct(negative), background: "var(--error)"   }} />
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 8 }} className="text-xs text-muted">
        {([
          ["var(--success)", "Positive", positive],
          ["var(--warning)", "Neutral",  neutral ],
          ["var(--error)",   "Negative", negative],
        ] as [string, string, number][]).map(([c, l, n]) => (
          <span key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block" }} />
            {l} {n}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="avatar avatar-sm">
      {initials}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card empty-state">
      <p className="empty-state-title">{title}</p>
      <p className="empty-state-body">{body}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ResearchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [research,       setResearch]       = useState<ResearchCampaign | null>(null);
  const [calls,          setCalls]          = useState<Call[]>([]);
  const [contacts,       setContacts]       = useState<Contact[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [tab,            setTab]            = useState<"overview" | "calls" | "transcripts" | "contacts">("overview");
  const [expandedCall,   setExpandedCall]   = useState<string | null>(null);
  const [callFilter,     setCallFilter]     = useState("all");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [notFound,       setNotFound]       = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/login"); return; }

      const { data: rc, error } = await supabase
        .from("research_campaigns")
        .select("*")
        .eq("id", id)
        .eq("user_id", session.user.id)
        .single();

      if (error || !rc) { setNotFound(true); setLoading(false); return; }
      setResearch(rc);

      if (rc.campaign_id) {
        const { data: callsData } = await supabase
          .from("calls")
          .select("*, transcripts(id, sentiment, excerpt, full_text, questions_count, created_at)")
          .eq("campaign_id", rc.campaign_id)
          .order("created_at", { ascending: false });
        setCalls(callsData ?? []);
      }

      const { data: contactsData } = await supabase
        .from("contact_list")
        .select("*")
        .eq("research_campaign_id", id)
        .order("created_at", { ascending: true });
      setContacts(contactsData ?? []);

      setLoading(false);
    };
    if (id) load();
  }, [id, router]);

  // ── Update status ──────────────────────────────────────────────────────────
  const updateStatus = async (newStatus: string) => {
    if (!research) return;
    setUpdatingStatus(true);
    const { data } = await supabase
      .from("research_campaigns")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", research.id)
      .select()
      .single();
    if (data) setResearch(data);
    setUpdatingStatus(false);
  };

  if (loading)  return <Skeleton />;
  if (notFound) return (
    <div className="page-content">
      <p className="text-muted" style={{ fontSize: 14 }}>Research campaign not found.</p>
    </div>
  );
  if (!research) return null;

  // ── Derived stats ──────────────────────────────────────────────────────────
  const allTranscripts = calls.flatMap(c =>
    c.transcripts.map(t => ({ ...t, participant_name: c.participant_name }))
  );
  const completed      = calls.filter(c => c.status === "completed").length;
  const missed         = calls.filter(c => ["missed", "failed"].includes(c.status)).length;
  const pending        = calls.filter(c => c.status === "pending").length;
  const inProgress     = calls.filter(c => c.status === "in-progress").length;
  const completionPct  = calls.length > 0 ? (completed / calls.length) * 100 : 0;
  const sentPos        = allTranscripts.filter(t => t.sentiment === "positive").length;
  const sentNeu        = allTranscripts.filter(t => t.sentiment === "neutral").length;
  const sentNeg        = allTranscripts.filter(t => t.sentiment === "negative").length;
  const filteredCalls  = callFilter === "all" ? calls : calls.filter(c => c.status === callFilter);
  const daysLeft       = Math.max(0, Math.ceil(
    (new Date(research.timeline_end).getTime() - Date.now()) / 86400000
  ));

  return (
    <div className="animate-fade-in page-content">

      {/* Back */}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => router.back()}
        style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6 }}
      >
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        All Campaigns
      </button>

      {/* Header card */}
      <div className="card" style={{ padding: "24px 28px" }}>
        <div className="flex-between" style={{ gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
              <h1 className="page-title" style={{ margin: 0 }}>{research.title}</h1>
              <Badge value={research.status} />
              {research.refinement_summary && (
                <span className="badge badge-success" title="AI refinement complete">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Refined
                </span>
              )}
            </div>
            <p className="text-secondary" style={{ marginBottom: 14, maxWidth: "65ch", lineHeight: 1.6 }}>
              {research.description}
            </p>
            <div className="meta-row">
              <span>📅 {fmt.date(research.timeline_start)} → {fmt.date(research.timeline_end)}</span>
              {daysLeft > 0
                ? <span className="text-primary" style={{ fontWeight: 500 }}>⏳ {daysLeft} days left</span>
                : <span className="text-error" style={{ fontWeight: 500 }}>Timeline ended</span>
              }
              <span>🗂 {research.question_bank_mode === "text" ? "Typed questions" : research.question_bank_file_name}</span>
              <span>👥 {contacts.length} contacts · {research.contact_list_file_name}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            <ProgressRing pct={completionPct} />
            <select
              disabled={updatingStatus}
              value={research.status}
              onChange={e => updateStatus(e.target.value)}
              className="select"
              style={{ opacity: updatingStatus ? 0.6 : 1 }}
            >
              {["draft", "active", "paused", "completed", "archived"].map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            <button
              type="button"
              className={research.refinement_summary ? "btn btn-secondary" : "btn btn-primary"}
              style={{ padding: "8px 14px", fontSize: 13 }}
              onClick={() => {
                const query = new URLSearchParams({
                  title: research.title,
                  researchId: research.id,
                });
                router.push(`/new_compaign/compaign_followup?${query.toString()}`);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
              </svg>
              {research.refinement_summary ? "Re-run refinement" : "Refine with AI"}
            </button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stats-grid">
        <StatCard label="Total Calls"     value={calls.length}          accent="var(--primary)"  />
        <StatCard label="Completed"       value={completed}             accent="var(--success)"  />
        <StatCard label="Missed / Failed" value={missed}                accent="var(--error)"    />
        <StatCard label="Pending"         value={pending}               accent="var(--warning)"  />
        <StatCard label="In Progress"     value={inProgress}            accent="var(--info)"     />
        <StatCard label="Transcripts"     value={allTranscripts.length} accent="var(--primary)"  />
      </div>

      {/* Sentiment bar */}
      {allTranscripts.length > 0 && (
        <div className="card" style={{ padding: "20px 24px" }}>
          <h3 className="section-title" style={{ marginBottom: 14 }}>
            Sentiment — {allTranscripts.length} transcript{allTranscripts.length !== 1 ? "s" : ""}
          </h3>
          <SentimentBar positive={sentPos} neutral={sentNeu} negative={sentNeg} total={allTranscripts.length} />
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar">
        {(["overview", "calls", "transcripts", "contacts"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`tab-item ${tab === t ? "tab-item-active" : ""}`}
          >
            {t === "overview"    && "Overview"}
            {t === "calls"       && `Calls (${calls.length})`}
            {t === "transcripts" && `Transcripts (${allTranscripts.length})`}
            {t === "contacts"    && `Contacts (${contacts.length})`}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ──────────────────────────────────────────────────── */}
      {tab === "overview" && research.refinement_summary && (
        <div className="card" style={{ padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h3 className="section-title" style={{ margin: 0 }}>AI Refinement</h3>
              {research.refinement_summary.completed_at && (
                <span className="text-muted text-xs">
                  · {fmt.date(research.refinement_summary.completed_at)}
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: "6px 10px", fontSize: 12 }}
              onClick={() => {
                const query = new URLSearchParams({ title: research.title, researchId: research.id });
                router.push(`/new_compaign/compaign_followup?${query.toString()}`);
              }}
            >
              Re-run
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div className="form-label">Improved questions</div>
              {research.refinement_summary.improved_questions && research.refinement_summary.improved_questions.length > 0 ? (
                <ol style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  {research.refinement_summary.improved_questions.map((q, i) => (
                    <li key={i} className="text-secondary" style={{ fontSize: 13, lineHeight: 1.55 }}>{q}</li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted" style={{ fontSize: 13 }}>None.</p>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div className="form-label">Key themes</div>
                {research.refinement_summary.key_themes && research.refinement_summary.key_themes.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {research.refinement_summary.key_themes.map((t, i) => (
                      <span key={i} className="badge badge-info">{t}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted" style={{ fontSize: 13 }}>None.</p>
                )}
              </div>

              {research.refinement_summary.notes && (
                <div>
                  <div className="form-label">Notes</div>
                  <p className="text-secondary" style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>
                    {research.refinement_summary.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* Details */}
          <div className="card" style={{ padding: "22px 24px" }}>
            <h3 className="section-title" style={{ marginBottom: 16 }}>Details</h3>
            <dl style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {([
                ["Status",        <Badge key="s" value={research.status} />],
                ["Start",         fmt.date(research.timeline_start)],
                ["End",           fmt.date(research.timeline_end)],
                ["Days left",     daysLeft > 0 ? `${daysLeft} days` : "Ended"],
                ["Question Bank", research.question_bank_mode === "text" ? "Typed text" : research.question_bank_file_name ?? "—"],
                ["Contact List",  `${contacts.length} contacts · ${research.contact_list_file_name}`],
                ["Created",       fmt.date(research.created_at)],
              ] as [string, React.ReactNode][]).map(([label, value]) => (
                <div key={label as string} className="detail-row">
                  <dt className="text-secondary">{label}</dt>
                  <dd className="text-primary" style={{ fontWeight: 500, textAlign: "right" }}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Question Bank */}
          <div className="card" style={{ padding: "22px 24px" }}>
            <h3 className="section-title" style={{ marginBottom: 16 }}>Question Bank</h3>
            {research.question_bank_mode === "text" && research.question_bank_text ? (
              <div className="text-secondary" style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 260, overflowY: "auto" }}>
                {research.question_bank_text}
              </div>
            ) : research.question_bank_mode === "file" ? (
              <div className="file-preview">
                <svg width="20" height="20" fill="none" stroke="var(--primary)" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="14,2 14,8 20,8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }} className="text-primary">{research.question_bank_file_name}</div>
                  <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>PDF uploaded</div>
                </div>
              </div>
            ) : (
              <p className="text-muted" style={{ fontSize: 13 }}>No question bank set.</p>
            )}
          </div>
        </div>
      )}

      {/* ── CALLS ─────────────────────────────────────────────────────── */}
      {tab === "calls" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Filter pills */}
          <div className="filter-pills">
            {["all", "pending", "in-progress", "completed", "missed", "failed"].map(f => {
              const count = f === "all" ? calls.length : calls.filter(c => c.status === f).length;
              return (
                <button
                  key={f}
                  onClick={() => setCallFilter(f)}
                  className={`filter-pill ${callFilter === f ? "filter-pill-active" : ""}`}
                >
                  {f === "all" ? "All" : f.replace("-", " ")} ({count})
                </button>
              );
            })}
          </div>

          {filteredCalls.length === 0 ? (
            <EmptyState title="No calls yet" body="Calls will appear once this research is active." />
          ) : (
            <div className="card table-card">
              <table className="data-table">
                <thead>
                  <tr>
                    {["Participant", "Status", "Scheduled", "Duration", "Transcripts", ""].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCalls.map(call => (
                    <>
                      <tr
                        key={call.id}
                        onClick={() => setExpandedCall(expandedCall === call.id ? null : call.id)}
                        className={`table-row-interactive ${expandedCall === call.id ? "table-row-active" : ""}`}
                      >
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Avatar name={call.participant_name} />
                            <div>
                              <div className="participant-name">{call.participant_name}</div>
                              <div className="participant-phone">{call.participant_phone ?? "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td><Badge value={call.status} /></td>
                        <td className="text-secondary">{fmt.date(call.scheduled_for)}</td>
                        <td className="tabular-nums">{fmt.duration(call.duration_seconds)}</td>
                        <td className="text-secondary">{call.transcripts.length}</td>
                        <td className="text-muted">
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d={expandedCall === call.id ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </td>
                      </tr>
                      {expandedCall === call.id && (
                        <tr key={`${call.id}-exp`}>
                          <td colSpan={6} className="expanded-row">
                            {call.transcripts.length === 0 ? (
                              <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>No transcript for this call.</p>
                            ) : call.transcripts.map(t => (
                              <div key={t.id} style={{ marginBottom: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                  <Badge value={t.sentiment ?? "unknown"} />
                                  <span className="text-muted" style={{ fontSize: 12 }}>{t.questions_count} questions answered</span>
                                </div>
                                {t.excerpt && (
                                  <blockquote className="transcript-quote">&ldquo;{t.excerpt}&rdquo;</blockquote>
                                )}
                              </div>
                            ))}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TRANSCRIPTS ───────────────────────────────────────────────── */}
      {tab === "transcripts" && (
        allTranscripts.length === 0 ? (
          <EmptyState title="No transcripts yet" body="Transcripts appear after calls are completed." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {allTranscripts.map(t => (
              <div key={t.id} className="card" style={{ padding: "18px 22px" }}>
                <div className="flex-between" style={{ marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={t.participant_name} />
                    <span className="participant-name">{t.participant_name}</span>
                    <Badge value={t.sentiment ?? "unknown"} />
                  </div>
                  <span className="text-muted" style={{ fontSize: 12 }}>{fmt.date(t.created_at)}</span>
                </div>
                {t.excerpt && (
                  <blockquote className="transcript-quote" style={{ marginBottom: 10 }}>&ldquo;{t.excerpt}&rdquo;</blockquote>
                )}
                <span className="text-muted" style={{ fontSize: 12 }}>{t.questions_count} questions answered</span>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── CONTACTS ──────────────────────────────────────────────────── */}
      {tab === "contacts" && (
        contacts.length === 0 ? (
          <EmptyState title="No contacts uploaded" body="Upload a contact list CSV when creating a campaign." />
        ) : (
          <div className="card table-card">
            <table className="data-table">
              <thead>
                <tr>
                  {["Name", "Phone", "Email", "Age", "Occupation"].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map(contact => (
                  <tr key={contact.id} className="table-row-interactive">
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={contact.name} />
                        <span className="participant-name">{contact.name}</span>
                      </div>
                    </td>
                    <td className="text-secondary">{contact.phone ?? "—"}</td>
                    <td className="text-secondary">{contact.email ?? "—"}</td>
                    <td className="text-secondary">{contact.age ?? "—"}</td>
                    <td className="text-secondary">{contact.occupation ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

    </div>
  );
}