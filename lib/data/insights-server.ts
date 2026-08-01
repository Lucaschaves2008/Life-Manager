import {
  cacheLife,
  cacheTag,
} from "next/cache";
import { db } from "@/lib/db";
import { dayKeySP, monthName, refDoDiaSP, spStartOfMonth } from "@/lib/dates";
import { tagUsuario } from "@/lib/cache-tags";
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

// Padrão de cache: wrapper mantém a assinatura original e converte o Date de
// request em chave estável (dayKeySP); a interna "use cache" reconstrói o ref
// com refDoDiaSP e registra a tag de cada módulo cujas tabelas lê.

/** Insights de finanças (usados na Home e no topo de Finanças). */
export async function insightsFinanceiros(
  contaFinanceiraId: string,
  ref: Date = new Date()
): Promise<Insight[]> {
  return insightsFinanceirosDoDia(contaFinanceiraId, dayKeySP(ref));
}

async function insightsFinanceirosDoDia(
  contaFinanceiraId: string,
  dia: string
): Promise<Insight[]> {
  "use cache";
  // lê transaction/category (via resumoDoMes/categoriasComparadas) e subscription
  cacheTag(tagUsuario(contaFinanceiraId, "financas"));
  cacheLife("usuario");

  const ref = refDoDiaSP(dia);
  const mes = monthName(ref);
  const [resumo, categorias, assinaturas] = await Promise.all([
    resumoDoMes(contaFinanceiraId, ref),
    categoriasComparadas(contaFinanceiraId, ref),
    db.subscription.findMany({ where: { contaFinanceiraId, status: "ativa" } }),
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
export async function insightDoDia(
  userId: string,
  contaFinanceiraId: string,
  ref: Date = new Date()
): Promise<Insight> {
  return insightDoDiaKey(userId, contaFinanceiraId, dayKeySP(ref));
}

async function insightDoDiaKey(
  userId: string,
  contaFinanceiraId: string,
  dia: string
): Promise<Insight> {
  "use cache";
  // finanças (insights + resumo), dieta (mediaKcal7d, diet, streak) e treinos (streak)
  cacheTag(
    tagUsuario(contaFinanceiraId, "financas"),
    tagUsuario(userId, "dieta"),
    tagUsuario(userId, "treinos")
  );
  cacheLife("usuario");

  const ref = refDoDiaSP(dia);
  const [financeiros, kcal7d, streak, dieta, resumo] = await Promise.all([
    insightsFinanceirosDoDia(contaFinanceiraId, dia),
    mediaKcal7d(userId, ref),
    streakLC(userId, ref),
    db.diet.findFirst({ where: { userId, ativa: true } }),
    resumoDoMes(contaFinanceiraId, ref),
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
  contaFinanceiraId: string,
  ref: Date = new Date()
): Promise<Insight> {
  return insightFinanceiroPrincipalDoDia(contaFinanceiraId, dayKeySP(ref));
}

async function insightFinanceiroPrincipalDoDia(
  contaFinanceiraId: string,
  dia: string
): Promise<Insight> {
  "use cache";
  cacheTag(tagUsuario(contaFinanceiraId, "financas"));
  cacheLife("usuario");

  const ref = refDoDiaSP(dia);
  const [financeiros, resumo] = await Promise.all([
    insightsFinanceirosDoDia(contaFinanceiraId, dia),
    resumoDoMes(contaFinanceiraId, ref),
  ]);
  return (
    pickInsight(financeiros) ??
    insightFallback(resumo.gastoMes, monthName(ref))
  );
}
