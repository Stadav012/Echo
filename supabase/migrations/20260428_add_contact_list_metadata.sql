-- Holds any CSV columns that don't map to canonical fields
-- (name, phone, email, age, occupation). Populated when the
-- New Research Campaign modal parses the contact list CSV in the browser.

alter table public.contact_list
  add column if not exists metadata jsonb;
