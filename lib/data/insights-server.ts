import { db } from "@/lib/db";
import { monthName, spStartOfMonth, toSP } from "@/lib/dates";
import {
  categoriasComparadas,
  resumoDoMes,
} from "@/lib/data/financas";
import { mediaKcal7d, streakLC } from "@/lib/data/home";
import {
  insightAssinatura,
  insightCategoriaDisparou,
  insightFallback,
  insightKcalForaDaMeta,
  insightRitmoDeGastos,
  insightStreakTreino,
  pickInsight,
  type Insight,
} from "@/lib/insights";

/** Insights de finanças (usados na Home e no topo de Finanças). */
export async function insightsFinanceiros(ref: Date = new Date()): Promise<Insight[]> {
  const mes = monthName(ref);
  const [resumo, categorias, assinaturas] = await Promise.all([
    resumoDoMes(ref),
    categoriasComparadas(ref),
    db.subscription.findMany({ where: { status: "ativa" } }),
  ]);

  const out: (Insight | null)[] = [];

  // categoria que mais disparou (>40%), ignorando valores irrisórios
  const candidatas = categorias
    .filter((c) => c.anterior >= 2000 && c.atual > c.anterior)
    .map((c) => ({ c, pct: ((c.atual - c.anterior) / c.anterior) * 100 }))
    .sort((a, b) => b.pct - a.pct);
  if (candidatas[0]) {
    out.push(
      insightCategoriaDisparou({
        categoria: candidatas[0].c.nome,
        emoji: candidatas[0].c.emoji,
        atual: candidatas[0].c.atual,
        anterior: candidatas[0].c.anterior,
        mes,
      })
    );
  }

  out.push(
    insightRitmoDeGastos({
      acumuladoAtual: resumo.acumuladoHoje,
      acumuladoAnteriorMesmoDia: resumo.acumuladoAnteriorMesmoDia,
      mes,
    })
  );

  const totalAssinaturas = assinaturas.reduce((s, a) => s + a.valor, 0);
  for (const a of assinaturas) {
    out.push(
      insightAssinatura({
        nome: a.nome,
        valor: a.valor,
        valorAnterior: a.valorAnterior,
        novaNoMes: a.criadoEm >= spStartOfMonth(ref),
        totalMensalAssinaturas: totalAssinaturas,
        qtdAssinaturas: assinaturas.length,
      })
    );
  }

  return out.filter((i): i is Insight => i !== null);
}

/** Insight do dia da Home: o mais relevante entre finanças/treino/dieta. */
export async function insightDoDia(ref: Date = new Date()): Promise<Insight> {
  const [financeiros, kcal7d, streak, dieta, resumo] = await Promise.all([
    insightsFinanceiros(ref),
    mediaKcal7d(ref),
    streakLC(ref),
    db.diet.findFirst({ where: { ativa: true } }),
    resumoDoMes(ref),
  ]);

  const todos: (Insight | null)[] = [
    ...financeiros,
    insightStreakTreino({
      streakAtual: streak.streak,
      recordeAnterior: streak.recordeAnterior,
    }),
    insightKcalForaDaMeta({
      mediaKcal7d: kcal7d,
      metaKcal: dieta?.metaKcal ?? 0,
    }),
  ];

  return (
    pickInsight(todos) ?? insightFallback(resumo.gastoMes, monthName(ref))
  );
}

/** Insight financeiro mais relevante (topo do módulo Finanças). */
export async function insightFinanceiroPrincipal(
  ref: Date = new Date()
): Promise<Insight> {
  const [financeiros, resumo] = await Promise.all([
    insightsFinanceiros(ref),
    resumoDoMes(ref),
  ]);
  return (
    pickInsight(financeiros) ??
    insightFallback(resumo.gastoMes, monthName(ref))
  );
}
