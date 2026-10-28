#!/usr/bin/env node
// Auditoria SOMENTE LEITURA do banco — confere se supabase/seguranca.sql está
// aplicado e se nada regrediu (tabela nova sem RLS, grant reaparecendo…).
//
//   node --env-file=.env.local scripts/verificar-banco.mjs
//
// Sai com código 1 se achar problema. Rode depois de todo `prisma db push`.
import { PrismaClient } from "@prisma/client";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL/DATABASE_URL ausente. Use: node --env-file=.env.local scripts/verificar-banco.mjs");
  process.exit(2);
}

const db = new PrismaClient({ datasourceUrl: url });
const problemas = [];

try {
  const semRls = await db.$queryRaw`
    select c.relname as tabela
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity
    order by 1`;
  for (const r of semRls) problemas.push(`tabela public."${r.tabela}" sem RLS`);

  // has_table_privilege enxerga grant direto, via PUBLIC e de qualquer grantor
  const grants = await db.$queryRaw`
    select n.nspname || '.' || c.relname as tabela, r.papel
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'), ('authenticated')) as r(papel)
    where n.nspname in ('public', 'seguranca') and c.relkind in ('r', 'p', 'v', 'm')
      and has_table_privilege(r.papel, c.oid, 'SELECT, INSERT, UPDATE, DELETE')
    order by 1, 2`;
  for (const g of grants) {
    problemas.push(`"${g.tabela}" acessível pela Data API como ${g.papel}`);
  }

  const policiesAbertas = await db.$queryRaw`
    select tablename as tabela, policyname as policy
    from pg_policies
    where schemaname = 'public' and (qual = 'true' or with_check = 'true')`;
  for (const p of policiesAbertas) problemas.push(`policy "${p.policy}" em "${p.tabela}" é USING (true)`);

  const perigosas = await db.$queryRaw`
    select policyname as policy from pg_policies
    where schemaname = 'public' and tablename = 'Profile' and cmd in ('UPDATE', 'ALL', 'INSERT')`;
  for (const p of perigosas) problemas.push(`policy de escrita "${p.policy}" em Profile (risco de auto-promoção a admin)`);

  const rateLimit = await db.$queryRaw`select to_regclass('seguranca.rate_limit') is not null as existe`;
  if (!rateLimit[0]?.existe) problemas.push("seguranca.rate_limit não existe — rate limit do login está desligado (fail-open)");

  const buckets = await db.$queryRaw`select id, public from storage.buckets order by id`;
  for (const b of buckets) {
    if (b.public && b.id !== "avatars") problemas.push(`bucket "${b.id}" é público`);
  }
} finally {
  await db.$disconnect();
}

if (problemas.length > 0) {
  console.error(`\n🔒 verificar-banco: ${problemas.length} problema(s)`);
  for (const p of problemas) console.error(`  ✗ ${p}`);
  console.error("\nCorreção: rode supabase/seguranca.sql (idempotente).\n");
  process.exit(1);
}
console.log("🔒 verificar-banco: ok — Data API fechada, RLS em tudo, rate limit ativo, buckets ok.");
