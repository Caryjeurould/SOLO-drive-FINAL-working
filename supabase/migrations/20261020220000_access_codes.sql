-- Temporary visitor access codes (the Operator demo). Only the code's hash is
-- stored. Row security on with no policies: only the access-codes Edge
-- Function (service role) reads or writes it.
create table public.access_codes (
  code_hash text primary key,
  label text not null unique,
  openings_used smallint not null default 0 check (openings_used between 0 and 2),
  created_at timestamptz not null default now(),
  first_signin_at timestamptz,
  status text not null default 'active' check (status in ('active', 'used', 'expired', 'cancelled'))
);
alter table public.access_codes enable row level security;
revoke all on public.access_codes from anon, authenticated;
