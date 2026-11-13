-- T20Session · banco do Supabase
-- Rode uma vez em: Supabase → SQL Editor → New query → cole tudo → Run.

create table if not exists public.mesas (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome       text not null default 'Nova mesa',
  estado     jsonb not null default '{}'::jsonb,
  atualizado timestamptz not null default now()
);

create index if not exists mesas_owner_idx on public.mesas (owner, atualizado desc);

-- Cada mestre só enxerga e altera as próprias mesas.
alter table public.mesas enable row level security;

drop policy if exists "mesas: dono le" on public.mesas;
drop policy if exists "mesas: dono cria" on public.mesas;
drop policy if exists "mesas: dono altera" on public.mesas;
drop policy if exists "mesas: dono apaga" on public.mesas;

create policy "mesas: dono le"     on public.mesas for select using (owner = auth.uid());
create policy "mesas: dono cria"   on public.mesas for insert with check (owner = auth.uid());
create policy "mesas: dono altera" on public.mesas for update using (owner = auth.uid()) with check (owner = auth.uid());
create policy "mesas: dono apaga"  on public.mesas for delete using (owner = auth.uid());

-- Tempo real: a tela dos jogadores recebe cada alteração da mesa.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mesas'
  ) then
    alter publication supabase_realtime add table public.mesas;
  end if;
end $$;
