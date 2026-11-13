-- T20Session · banco do Supabase
-- Rode uma vez em: Supabase → SQL Editor → New query → cole tudo → Run.

create table if not exists public.mesas (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome       text not null default 'Nova mesa',
  estado     jsonb not null default '{}'::jsonb,
  atualizado timestamptz not null default now(),
  codigo     text unique -- link público da tela dos jogadores (nulo = não compartilhada)
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

-- Compartilhar por link (sem login, só leitura): coluna codigo + função mesa_publica.
-- Mesmo conteúdo de supabase/002_compartilhar.sql (quem já tinha o banco roda só aquele arquivo).

-- Código do link público. Nulo = mesa não compartilhada.
alter table public.mesas add column if not exists codigo text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mesas_codigo_key' and conrelid = 'public.mesas'::regclass) then
    alter table public.mesas add constraint mesas_codigo_key unique (codigo);
  end if;
end $$;

-- Leitura pública só por esta função (o RLS de select continua só para o dono).
-- Devolve {id, nome, estado} da mesa com esse código, ou null.
-- O estado vai sem inimigos ocultos (visivel = false), sem histórico e sem recentes;
-- os ids dos ocultos ficam em combate.ocultos para a tela mostrar "???" na vez deles.
create or replace function public.mesa_publica(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m       record;
  e       jsonb;
  ocultos text[];
begin
  if p_codigo is null or length(p_codigo) < 12 then
    return null;
  end if;
  select id, nome, estado into m from public.mesas where codigo = p_codigo;
  if not found then
    return null;
  end if;
  e := coalesce(m.estado, '{}'::jsonb) - 'log' - 'recentes';
  if jsonb_typeof(e -> 'combate') = 'object' then
    select coalesce(array_agg(x ->> 'id'), '{}')
      into ocultos
      from jsonb_array_elements(coalesce(e #> '{combate,inimigos}', '[]'::jsonb)) x
     where x ->> 'visivel' = 'false';
    e := jsonb_set(e, '{combate,inimigos}', coalesce(
      (select jsonb_agg(x)
         from jsonb_array_elements(coalesce(e #> '{combate,inimigos}', '[]'::jsonb)) x
        where coalesce(x ->> 'visivel', 'true') <> 'false'),
      '[]'::jsonb));
    e := jsonb_set(e, '{combate,inis}', coalesce(e #> '{combate,inis}', '{}'::jsonb) - ocultos);
    e := jsonb_set(e, '{combate,ocultos}', to_jsonb(ocultos));
  end if;
  return jsonb_build_object('id', m.id, 'nome', m.nome, 'estado', e);
end;
$$;

revoke all on function public.mesa_publica(text) from public;
grant execute on function public.mesa_publica(text) to anon, authenticated;
