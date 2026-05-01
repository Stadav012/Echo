-- Adds the columns needed to link a `calls` row to a voice-call session and
-- to a specific contact in the research_campaigns flow. The Next.js
-- /api/voice/sessions route writes to these on every "Generate call link"
-- click; /api/voice/callback updates them when the voice service finishes.

alter table public.calls
  add column if not exists contact_id uuid
    references public.contact_list(id) on delete set null,
  add column if not exists session_id text,
  add column if not exists research_campaign_id uuid
    references public.research_campaigns(id) on delete cascade,
  add column if not exists completed_at timestamptz,
  add column if not exists scheduled_for timestamptz;

create index if not exists idx_calls_session_id on public.calls(session_id);
create index if not exists idx_calls_contact_id on public.calls(contact_id);
create index if not exists idx_calls_research_campaign_id
  on public.calls(research_campaign_id);
