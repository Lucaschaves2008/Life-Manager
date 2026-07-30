import {
  cacheLife,
  cacheTag,
} from "next/cache";
import { subDays } from "date-fns";
import { db } from "@/lib/db";
import { tagUsuario } from "@/lib/cache-tags";
import { dayKeySP, spEndOfDay, spStartOfDay } from "@/lib/dates";

/**
 * Variáveis pessoais contáveis: métricas livres criadas pelo usuário (ex.:
 * "Corrida", "Sem pornografia"), marcadas no checklist diário e consumíveis
 * como origem de progresso tanto em MetaQuantitativa quanto em DesafioMeta.
 * Streak é calculado com 1 única query por variável (ou em lote, 1 query pra
 * N variáveis) — nunca um loop de queries por dia, mesmo padrão anti-N+1 de
 * metas-quantitativas.ts e desafios.ts.
 */

/** Janela máxima (dias) escaneada para calcular streak — trade-off consciente: */
/** streaks reais maiores que isso seriam subestimados. 730 dias = ~2 anos. */
const STREAK_LIMITE_DIAS = 730;

export type VariavelView = {
  id: string;
  nome: string;
  emoji: string;
  cor: string;
  medeStreak: boolean;
  medeContagem: boolean;
  ordem: number;
};

/** Variáveis ativas do usuário — checklist diário e seletores de origem (Metas/Desafios). */
export async function variaveisAtivas(userId: string): Promise<VariavelView[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "checklist"));
  cacheTag(tagUsuario(userId, "metas"));
  cacheLife("days");
  const variaveis = await db.variavel.findMany({
    where: { userId, ativo: true },
    orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
  });
  return variaveis.map((v) => ({
    id: v.id,
    nome: v.nome,
    emoji: v.emoji,
    cor: v.cor,
    medeStreak: v.medeStreak,
    medeContagem: v.medeContagem,
    ordem: v.ordem,
  }));
}

/**
 * Contagem de ocorrências marcadas no período [inicio,fim] para 1+ variáveis,
 * em 1 única query (variavelId IN [...]) — espelha calcularAtualEmLote de
 * metas-quantitativas.ts. Usado por MetaQuantitativa e DesafioMeta.
 */
export async function contarOcorrenciasEmLote(
  userId: string,
  pares: { variavelId: string; inicio: Date; fim: Date }[]
): Promise<number[]> {
  if (pares.length === 0) return [];
  const variavelIds = [...new Set(pares.map((p) => p.variavelId))];
  const inicioTotal = new Date(Math.min(...pares.map((p) => p.inicio.getTime())));
  const fimTotal = new Date(Math.max(...pares.map((p) => p.fim.getTime())));

  const checks = await db.variavelCheckDia.findMany({
    where: {
      userId,
      variavelId: { in: variavelIds },
      data: { gte: inicioTotal, lte: fimTotal },
    },
    select: { variavelId: true, data: true },
  });

  return pares.map(
    ({ variavelId, inicio, fim }) =>
      checks.filter((c) => c.variavelId === variavelId && c.data >= inicio && c.data <= fim).length
  );
}

/** Sequência de dayKeys marcados, mais recente primeiro, dentro da janela de STREAK_LIMITE_DIAS. */
async function dayKeysMarcadosEmLote(
  userId: string,
  variavelIds: string[],
  hoje: Date
): Promise<Map<string, Set<string>>> {
  const de = spStartOfDay(subDays(hoje, STREAK_LIMITE_DIAS));
  const ate = spEndOfDay(hoje);

  const checks = await db.variavelCheckDia.findMany({
    where: { userId, variavelId: { in: variavelIds }, data: { gte: de, lte: ate } },
    select: { variavelId: true, data: true },
  });

  const porVariavel = new Map<string, Set<string>>();
  for (const c of checks) {
    const set = porVariavel.get(c.variavelId) ?? new Set<string>();
    set.add(dayKeySP(c.data));
    porVariavel.set(c.variavelId, set);
  }
  return porVariavel;
}

/** Conta dias consecutivos marcados até `hoje` (ou até ontem, se hoje ainda não foi marcado). */
function streakDoSet(dayKeys: Set<string>, hoje: Date): number {
  let cursor = hoje;
  if (!dayKeys.has(dayKeySP(cursor))) {
    cursor = subDays(cursor, 1);
  }
  let streak = 0;
  while (dayKeys.has(dayKeySP(cursor))) {
    streak++;
    cursor = subDays(cursor, 1);
  }
  return streak;
}

/** Streak atual (dias consecutivos) de 1 variável — 1 query, sem loop. */
export async function calcularStreak(userId: string, variavelId: string, hoje: Date): Promise<number> {
  const mapa = await dayKeysMarcadosEmLote(userId, [variavelId], hoje);
  return streakDoSet(mapa.get(variavelId) ?? new Set(), hoje);
}

/** Streak em lote para N variáveis — 1 query cobrindo todas, sem N+1. */
export async function calcularStreakEmLote(
  userId: string,
  variavelIds: string[],
  hoje: Date
): Promise<Map<string, number>> {
  if (variavelIds.length === 0) return new Map();
  const mapa = await dayKeysMarcadosEmLote(userId, variavelIds, hoje);
  return new Map(variavelIds.map((id) => [id, streakDoSet(mapa.get(id) ?? new Set(), hoje)]));
}

// ---------- Checklist diário ----------

export type VariavelChecklistItem = VariavelView & { feito: boolean; streakAtual: number | null };

/** Map variavelId → feito, para o dia. */
export async function checksVariavelDoDia(userId: string, dayKey: string): Promise<Set<string>> {
  "use cache";
  cacheTag(tagUsuario(userId, "checklist"));
  cacheLife("days");
  const from = spStartOfDay(new Date(`${dayKey}T12:00:00-03:00`));
  const to = spEndOfDay(from);
  const checks = await db.variavelCheckDia.findMany({
    where: { userId, data: { gte: from, lte: to } },
    select: { variavelId: true },
  });
  return new Set(checks.map((c) => c.variavelId));
}

/**
 * Variáveis ativas do usuário, já com feito/streak do dia — para renderizar
 * junto com rotinasDoDia no checklist unificado (ver app/checklist/page.tsx).
 */
export async function variaveisDoDia(userId: string, dia: Date): Promise<VariavelChecklistItem[]> {
  const dayKey = dayKeySP(dia);
  const [variaveis, checks] = await Promise.all([
    variaveisAtivas(userId),
    checksVariavelDoDia(userId, dayKey),
  ]);
  if (variaveis.length === 0) return [];

  const comStreak = variaveis.filter((v) => v.medeStreak);
  const streaks =
    comStreak.length > 0
      ? await calcularStreakEmLote(userId, comStreak.map((v) => v.id), dia)
      : new Map<string, number>();

  return variaveis.map((v) => ({
    ...v,
    feito: checks.has(v.id),
    streakAtual: v.medeStreak ? streaks.get(v.id) ?? 0 : null,
  }));
}
