-- =============================================================================
-- Endurecimento do banco (Supabase) — IDEMPOTENTE, pode rodar quantas vezes
-- quiser. Rode DEPOIS do deploy do código que acompanha este arquivo:
--   Supabase Dashboard → SQL Editor → colar e rodar
--   (ou: psql "$DIRECT_URL" -f supabase/seguranca.sql)
-- Depois confira com: node --env-file=.env.local scripts/verificar-banco.mjs
--
-- POR QUE: a chave publishable do Supabase vai no bundle do navegador (é
-- pública por definição). Com ela, qualquer pessoa fala direto com a Data API
-- (PostgREST) em https://<ref>.supabase.co/rest/v1/<Tabela>. O app NÃO usa a
-- Data API — todo dado passa pelo Prisma no servidor, com conexão própria
-- (role postgres) — então anon/authenticated não precisam de privilégio
-- nenhum nas tabelas. Fechar isso elimina a classe inteira de ataque
-- "abro o console, colo um fetch e puxo dados em bloco".
--
-- Achado concreto que motivou: a policy profile_update_own_or_admin deixava
-- qualquer usuário logado fazer
--   PATCH /rest/v1/Profile?id=eq.<seu-id>  {"role":"super_admin"}
-- e virar administrador (ou se desbloquear: {"status":"ativo"}).
-- =============================================================================

begin;

-- 1) Data API fechada no schema public ------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- tabelas que o Prisma criar no futuro (owner = postgres) nascem sem grant
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

-- 2) RLS ligado em TODA tabela do public (defesa em profundidade) ---------
do $$
declare t record;
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', t.relname);
    raise notice 'RLS ligado em %', t.relname;
  end loop;
end $$;

-- 3) Policies perigosas do Profile ----------------------------------------
-- UPDATE sem restrição de coluna = auto-promoção a super_admin. A de SELECT é
-- recursiva (consulta Profile dentro da policy de Profile). O app não usa
-- nenhuma das duas (Prisma ignora RLS), então saem.
drop policy if exists profile_update_own_or_admin on public."Profile";
drop policy if exists profile_select_own_or_admin on public."Profile";

-- 4) Schema privado para controles de segurança ---------------------------
-- Fora do public: o `prisma db push` não gerencia (não tenta dropar) e a
-- Data API não expõe.
create schema if not exists seguranca;
revoke all on schema seguranca from public, anon, authenticated;

create table if not exists seguranca.rate_limit (
  chave          text        primary key,
  contador       integer     not null,
  janela_inicio  timestamptz not null
);
create index if not exists rate_limit_janela_idx on seguranca.rate_limit (janela_inicio);
alter table seguranca.rate_limit enable row level security;
revoke all on all tables in schema seguranca from public, anon, authenticated;

-- 5) Storage ---------------------------------------------------------------
-- Documento do desafio ("contrato do grupo") deixa de ser público: o app
-- passa a entregar URL assinada de 1h só para membros do desafio.
-- Avatares continuam públicos (aparecem para os outros membros).
update storage.buckets set public = false where id = 'desafio-documentos';

commit;

-- 6) (opcional) RLS automático em tabela nova -------------------------------
-- Event trigger exige privilégio que alguns planos/versões do Supabase não
-- dão ao role postgres. Se não der, só avisa — os itens 1 e 2 já cobrem.
create or replace function seguranca.rls_automatico()
returns event_trigger language plpgsql as $$
declare obj record;
begin
  for obj in
    select * from pg_event_trigger_ddl_commands()
    where command_tag = 'CREATE TABLE' and schema_name = 'public'
  loop
    execute format('alter table %s enable row level security', obj.object_identity);
  end loop;
end $$;

do $$
begin
  drop event trigger if exists seguranca_rls_automatico;
  create event trigger seguranca_rls_automatico
    on ddl_command_end when tag in ('CREATE TABLE')
    execute function seguranca.rls_automatico();
exception when insufficient_privilege then
  raise notice 'Sem privilégio para event trigger — ok, itens 1 e 2 já protegem.';
end $$;
