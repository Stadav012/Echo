-- Adds storage for the AI refinement output produced by the
-- /new_compaign/compaign_followup chat (FSM: Interview 1 -> Feedback 1 ->
-- Interview 2 -> Feedback 2 -> Done). Written by the client after the final
-- /api/refine/finalize call returns a structured summary.
--
-- Expected JSON shape:
--   {
--     "feedback_1": "...",
--     "feedback_2": "...",
--     "improved_questions": ["..."],
--     "key_themes": ["..."],
--     "notes": "...",
--     "completed_at": "ISO-8601"
--   }

alter table public.research_campaigns
  add column if not exists refinement_summary jsonb;
