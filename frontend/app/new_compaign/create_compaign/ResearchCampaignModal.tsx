"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

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

const RESEARCH_ASSETS_BUCKET = "research-assets";

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default function ResearchCampaignModal({ isOpen, onClose }: ResearchCampaignModalProps) {
  const router = useRouter();
  const [questionBankMode, setQuestionBankMode] = useState<"text" | "file">("text");
  const [title, setTitle] = useState(initialState.title);
  const [description, setDescription] = useState(initialState.description);
  const [questionBankText, setQuestionBankText] = useState(initialState.questionBankText);
  const [startAt, setStartAt] = useState(initialState.startAt);
  const [endAt, setEndAt] = useState(initialState.endAt);
  const [questionBankFile, setQuestionBankFile] = useState<File | null>(null);
  const [contactListFile, setContactListFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showRefinePrompt, setShowRefinePrompt] = useState(false);
  const [createdResearchId, setCreatedResearchId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const handleClose = () => {
    if (isSubmitting) return;
    setTitle(initialState.title);
    setDescription(initialState.description);
    setQuestionBankText(initialState.questionBankText);
    setStartAt(initialState.startAt);
    setEndAt(initialState.endAt);
    setQuestionBankMode("text");
    setQuestionBankFile(null);
    setContactListFile(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowRefinePrompt(false);
    setCreatedResearchId(null);
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user?.id) {
        throw new Error("You must be signed in to create a research campaign.");
      }

      if (!contactListFile) {
        throw new Error("Please upload a contact list CSV file.");
      }

      if (questionBankMode === "file" && !questionBankFile) {
        throw new Error("Please upload a question bank PDF file.");
      }

      const userId = session.user.id;
      const timePrefix = Date.now();

      let questionBankFilePath: string | null = null;
      if (questionBankMode === "file" && questionBankFile) {
        questionBankFilePath = `${userId}/question-bank/${timePrefix}-${sanitizeFileName(questionBankFile.name)}`;
        const { error: uploadQuestionBankError } = await supabase.storage
          .from(RESEARCH_ASSETS_BUCKET)
          .upload(questionBankFilePath, questionBankFile, { upsert: false });

        if (uploadQuestionBankError) {
          throw new Error(`Failed to upload question bank PDF: ${uploadQuestionBankError.message}`);
        }
      }

      const contactListFilePath = `${userId}/contact-list/${timePrefix}-${sanitizeFileName(contactListFile.name)}`;
      const { error: uploadContactListError } = await supabase.storage
        .from(RESEARCH_ASSETS_BUCKET)
        .upload(contactListFilePath, contactListFile, { upsert: false });

      if (uploadContactListError) {
        throw new Error(`Failed to upload contact list CSV: ${uploadContactListError.message}`);
      }

      const { data: insertedResearch, error: insertError } = await supabase.from("research_campaigns").insert({
        user_id: userId,
        title,
        description,
        question_bank_mode: questionBankMode,
        question_bank_text: questionBankMode === "text" ? questionBankText : null,
        question_bank_file_name: questionBankMode === "file" && questionBankFile ? questionBankFile.name : null,
        question_bank_file_path: questionBankMode === "file" ? questionBankFilePath : null,
        question_bank_file_type: questionBankMode === "file" && questionBankFile ? questionBankFile.type || "application/pdf" : null,
        contact_list_file_name: contactListFile.name,
        contact_list_file_path: contactListFilePath,
        contact_list_file_type: contactListFile.type || "text/csv",
        timeline_start: new Date(startAt).toISOString(),
        timeline_end: new Date(endAt).toISOString(),
      }).select("id").single();

      if (insertError) {
        throw new Error(`Failed to save research campaign: ${insertError.message}`);
      }

      setSuccessMessage("Research campaign created successfully.");
      setCreatedResearchId(insertedResearch?.id ?? null);
      setShowRefinePrompt(true);
    } catch (error) {
      const fallbackMessage = "Unable to create research campaign. Please try again.";
      setErrorMessage(error instanceof Error ? error.message : fallbackMessage);
    } finally {
      setIsSubmitting(false);
    }
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
                  onClick={() => {
                    setQuestionBankMode("text");
                    setQuestionBankFile(null);
                  }}
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
                  required={questionBankMode === "text"}
                />
              ) : (
                <div>
                  <input
                    className="input-base"
                    type="file"
                    accept=".pdf,application/pdf"
                    required={questionBankMode === "file"}
                    style={{ padding: "10px 12px" }}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setQuestionBankFile(file);
                    }}
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
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setContactListFile(file);
                }}
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

          {(errorMessage || successMessage) && (
            <div
              style={{
                marginTop: "14px",
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                fontSize: "13px",
                border: "1px solid",
                borderColor: errorMessage ? "var(--danger)" : "var(--success)",
                color: errorMessage ? "#991B1B" : "#065F46",
                background: errorMessage ? "var(--danger-light)" : "var(--success-light)",
              }}
            >
              {errorMessage || successMessage}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "22px", paddingTop: "16px", paddingBottom: "50px", borderTop: "1px solid var(--border-light)" }}>
            <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Research Campaign"}
            </button>
          </div>
        </form>
      </div>

      {showRefinePrompt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Refine research with AI"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            background: "rgba(17, 24, 39, 0.38)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            className="card animate-scale-in"
            style={{
              width: "min(520px, 100%)",
              padding: "22px",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <h3 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
              Refine this research with AI?
            </h3>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "18px", lineHeight: 1.5 }}>
              You can improve your research questions and add richer context in a guided AI chat.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClose}
              >
                No, maybe later
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const query = new URLSearchParams({
                    title,
                    ...(createdResearchId ? { researchId: createdResearchId } : {}),
                  });
                  handleClose();
                  router.push(`/new_compaign/compaign_followup?${query.toString()}`);
                }}
              >
                Yes, refine with AI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
