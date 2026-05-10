drop policy if exists "Allow public note reads" on public.notes;
drop policy if exists "Allow public note inserts" on public.notes;
drop policy if exists "Allow public note deletes" on public.notes;

alter table public.notes enable row level security;
