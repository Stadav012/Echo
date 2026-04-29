-- Allow authenticated users to read/insert/update/delete contacts that belong
-- to a research_campaign they own. The browser supabase client runs as the
-- user, so auth.uid() resolves to the campaign owner.

alter table public.contact_list enable row level security;

drop policy if exists "contact_list_select_own" on public.contact_list;
create policy "contact_list_select_own"
on public.contact_list
for select
to authenticated
using (
  exists (
    select 1
    from public.research_campaigns rc
    where rc.id = contact_list.research_campaign_id
      and rc.user_id = auth.uid()
  )
);

drop policy if exists "contact_list_insert_own" on public.contact_list;
create policy "contact_list_insert_own"
on public.contact_list
for insert
to authenticated
with check (
  exists (
    select 1
    from public.research_campaigns rc
    where rc.id = contact_list.research_campaign_id
      and rc.user_id = auth.uid()
  )
);

drop policy if exists "contact_list_update_own" on public.contact_list;
create policy "contact_list_update_own"
on public.contact_list
for update
to authenticated
using (
  exists (
    select 1
    from public.research_campaigns rc
    where rc.id = contact_list.research_campaign_id
      and rc.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.research_campaigns rc
    where rc.id = contact_list.research_campaign_id
      and rc.user_id = auth.uid()
  )
);

drop policy if exists "contact_list_delete_own" on public.contact_list;
create policy "contact_list_delete_own"
on public.contact_list
for delete
to authenticated
using (
  exists (
    select 1
    from public.research_campaigns rc
    where rc.id = contact_list.research_campaign_id
      and rc.user_id = auth.uid()
  )
);
