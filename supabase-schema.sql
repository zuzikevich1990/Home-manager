create extension if not exists pgcrypto;

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  widget_id text not null check (widget_id in ('watch', 'cactus')),
  widget_label text not null,
  text text not null check (length(trim(text)) > 0),
  telegram_user_id bigint,
  telegram_first_name text,
  created_at timestamptz not null default now()
);

alter table public.notes enable row level security;

create policy "Allow public note reads"
on public.notes
for select
to anon
using (true);

create policy "Allow public note inserts"
on public.notes
for insert
to anon
with check (true);

create policy "Allow public note deletes"
on public.notes
for delete
to anon
using (true);
