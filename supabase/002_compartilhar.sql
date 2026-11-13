-- T20Session · compartilhar a tela dos jogadores por link (sem login, só leitura)
-- Rode UMA vez, depois do schema.sql: Supabase → SQL Editor → New query → cole tudo → Run.
-- Pode rodar de novo sem problema (idempotente).

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
