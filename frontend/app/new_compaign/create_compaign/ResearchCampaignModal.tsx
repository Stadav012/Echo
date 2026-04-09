"use client";

import { FormEvent, useEffect, useState } from "react";

type ResearchCampaignModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const initialState = {
  title: "",
  description: "",
  questionBankText: "",
  startAt: "",
  endAt: "",
};

export default function ResearchCampaignModal({ isOpen, onClose }: ResearchCampaignModalProps) {
  const [questionBankMode, setQuestionBankMode] = useState<"text" | "file">("text");
  const [title, setTitle] = useState(initialState.title);
  const [description, setDescription] = useState(initialState.description);
  const [questionBankText, setQuestionBankText] = useState(initialState.questionBankText);
  const [startAt, setStartAt] = useState(initialState.startAt);
  const [endAt, setEndAt] = useState(initialState.endAt);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const handleClose = () => {
    setTitle(initialState.title);
    setDescription(initialState.description);
    setQuestionBankText(initialState.questionBankText);
    setStartAt(initialState.startAt);
    setEndAt(initialState.endAt);
    setQuestionBankMode("text");
    onClose();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create new research campaign"
      onClick={handleClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(17, 24, 39, 0.45)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        className="card animate-scale-in"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(860px, 100%)",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "26px 26px 40px",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "14px", marginBottom: "18px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
              New Research Campaign
            </h2>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
              Add background information on your research, initial contact list and prefered timeline.
            </p>
          </div>
          <button type="button" className="btn btn-ghost" style={{ padding: "8px", minWidth: "36px" }} onClick={handleClose} aria-label="Close modal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gap: "18px" }}>
            <div>
              <label className="form-label" htmlFor="campaign-title">
                Title
              </label>
              <input
                id="campaign-title"
                className="input-base"
                placeholder="e.g. New Feature Discovery Research"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label" htmlFor="campaign-description">
                Description
              </label>
              <textarea
                id="campaign-description"
                className="input-base"
                placeholder="Describe goals, target audience, and expected outcomes."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                style={{ resize: "vertical", minHeight: "110px" }}
                required
              />
            </div>

            <div className="card" style={{ padding: "16px", background: "var(--primary-subtle)", borderColor: "var(--border-light)" }}>
              <div style={{ marginBottom: "12px" }}>
                <label className="form-label" style={{ marginBottom: "4px" }}>
                  Question Bank
                </label>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  Choose to enter questions directly or upload a PDF.
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <button
                  type="button"
                  className={questionBankMode === "text" ? "btn btn-primary" : "btn btn-secondary"}
                  style={{ fontSize: "13px", padding: "8px 14px" }}
                  onClick={() => setQuestionBankMode("text")}
                >
                  Enter Text
                </button>
                <button
                  type="button"
                  className={questionBankMode === "file" ? "btn btn-primary" : "btn btn-secondary"}
                  style={{ fontSize: "13px", padding: "8px 14px" }}
                  onClick={() => setQuestionBankMode("file")}
                >
                  Upload PDF
                </button>
              </div>

              {questionBankMode === "text" ? (
                <textarea
                  className="input-base"
                  placeholder="Paste your interview questions here..."
                  value={questionBankText}
                  onChange={(event) => setQuestionBankText(event.target.value)}
                  rows={5}
                  style={{ resize: "vertical", minHeight: "130px" }}
                  required
                />
              ) : (
                <div>
                  <input
                    className="input-base"
                    type="file"
                    accept=".pdf,application/pdf"
                    required
                    style={{ padding: "10px 12px" }}
                  />
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
                    Accepted format: PDF
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="form-label" htmlFor="contact-list-file">
                Contact List (CSV)
              </label>
              <input
                id="contact-list-file"
                className="input-base"
                type="file"
                accept=".csv,text/csv"
                required
                style={{ padding: "10px 12px" }}
              />
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
                Upload columns like name, contact, age, occupation, and any custom fields you need.
              </p>
            </div>

            <div>
              <label className="form-label">Timeline</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>
                <div>
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "6px" }}>Start</p>
                  <input
                    className="input-base"
                    type="datetime-local"
                    value={startAt}
                    onChange={(event) => setStartAt(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "6px" }}>End</p>
                  <input
                    className="input-base"
                    type="datetime-local"
                    value={endAt}
                    onChange={(event) => setEndAt(event.target.value)}
                    min={startAt || undefined}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "22px", paddingTop: "16px", paddingBottom: "50px", borderTop: "1px solid var(--border-light)" }}>
            <button type="button" className="btn btn-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Research Campaign
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
