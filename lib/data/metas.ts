import {
  cacheLife,
  cacheTag,
} from "next/cache";
import { eachMonthOfInterval, subMonths } from "date-fns";
import { db } from "@/lib/db";
import { tagUsuario } from "@/lib/cache-tags";
import {
  dayKeySP,
  monthName,
  refDoDiaSP,
  spEndOfMonth,
  spStartOfMonth,
  toSP,
} from "@/lib/dates";
import { formatBRL, formatBRLCompact } from "@/lib/money";
import { resumoCarteira } from "@/lib/data/investimentos";
import { resumoTreinos } from "@/lib/data/treinos";
import { aderencia7d, evolucaoPeso } from "@/lib/data/dieta";
import { dashboardEstudos } from "@/lib/data/estudos";

// Painel "Evolução do mês" na página de Metas. Cada área expõe o MESMO formato
// normalizado (AreaEvolucaoView) para o card client renderizar de forma uniforme
// — número grande, variação vs. período anterior, mini-sparkline e detalhe.
// Todos os números são derivados dos dados que já existem em cada módulo.

export type AreaKey =
  | "financas"
  | "treinos"
  | "dieta"
  | "estudos"
  | "investimentos";

/** Uma linha do detalhamento (ao clicar no card). */
export type LinhaDetalhe = {
  label: string;
  valor: string;
  hint?: string;
  cor?: string;
  /** proporção 0–1 p/ a barra */
  share?: number;
};

export type AreaEvolucaoView = {
  key: AreaKey;
  nome: string;
  emoji: string;
  href: string;
  /** cor de acento (CSS var) */
  cor: string;
  /** número grande do card */
  valor: string;
  /** legenda curta abaixo do número (ex.: "neste mês") */
  contexto: string;
  /** variação % vs. período anterior; null = sem base de comparação */
  pct: number | null;
  /** true quando subir é ruim (ex.: gastos) — inverte a cor do badge */
  upIsBad?: boolean;
  /** série p/ a sparkline (últimos pontos, o último é o atual) */
  serie: number[];
  /** frase-resumo no dialog */
  descricao: string;
  /** linhas de detalhamento */
  detalhe: LinhaDetalhe[];
  /** rótulo do total no rodapé do dialog */
  total?: { label: string; valor: string };
};

function variacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

// ---------- Finanças: gasto do mês (6 meses de série) ----------

async function areaFinancas(userId: string, ref: Date): Promise<AreaEvolucaoView> {
  const meses = eachMonthOfInterval({
    start: spStartOfMonth(subMonths(toSP(ref), 5)),
    end: spStartOfMonth(ref),
  });
  const inicioTotal = spStartOfMonth(meses[0]);
  const fimTotal = spEndOfMonth(ref);

  // 1 query cobrindo os 6 meses (em vez de 1 aggregate por mês) — bucketiza em memória.
  const [despesas, assinaturas] = await Promise.all([
    db.transaction.findMany({
      where: { userId, tipo: "despesa", data: { gte: inicioTotal, lte: fimTotal } },
      select: { valor: true, data: true, categoryId: true },
    }),
    db.subscription.findMany({
      where: { userId, status: "ativa" },
      select: { valor: true },
    }),
  ]);

  const assinaturasMes = assinaturas.reduce((s, a) => s + a.valor, 0);
  const serie = meses.map((m) => {
    const inicio = spStartOfMonth(m);
    const fim = spEndOfMonth(m);
    const soma = despesas
      .filter((d) => d.data >= inicio && d.data <= fim)
      .reduce((s, d) => s + d.valor, 0);
    return soma + assinaturasMes;
  });
  const atual = serie.at(-1) ?? 0;
  const anterior = serie.at(-2) ?? 0;

  // categorias do mês de referência p/ o detalhamento (a partir do mesmo lote já buscado)
  const inicioRef = spStartOfMonth(ref);
  const fimRef = spEndOfMonth(ref);
  const somaPorCategoria = new Map<string, number>();
  for (const d of despesas) {
    if (!d.categoryId) continue;
    if (d.data < inicioRef || d.data > fimRef) continue;
    somaPorCategoria.set(d.categoryId, (somaPorCategoria.get(d.categoryId) ?? 0) + d.valor);
  }
  const catAgg = [...somaPorCategoria.entries()]
    .map(([categoryId, valor]) => ({ categoryId, _sum: { valor } }))
    .sort((a, b) => b._sum.valor - a._sum.valor)
    .slice(0, 4);
  const cats = await db.category.findMany({
    where: { id: { in: catAgg.map((c) => c.categoryId).filter(Boolean) as string[] } },
  });
  const catMap = new Map(cats.map((c) => [c.id, c]));
  const detalhe: LinhaDetalhe[] = catAgg
    .filter((c) => c.categoryId)
    .map((c) => {
      const cat = catMap.get(c.categoryId!);
      const v = c._sum.valor ?? 0;
      return {
        label: `${cat?.emoji ?? ""} ${cat?.nome ?? "—"}`.trim(),
        valor: formatBRL(v),
        cor: cat?.cor ?? "var(--color-steel)",
        share: atual > 0 ? v / atual : 0,
        hint: `${Math.round(atual > 0 ? (v / atual) * 100 : 0)}%`,
      };
    });
  if (assinaturasMes > 0) {
    detalhe.push({
      label: "Assinaturas",
      valor: formatBRL(assinaturasMes),
      cor: "var(--cal-lilac)",
      share: atual > 0 ? assinaturasMes / atual : 0,
      hint: `${Math.round(atual > 0 ? (assinaturasMes / atual) * 100 : 0)}%`,
    });
  }

  return {
    key: "financas",
    nome: "Finanças",
    emoji: "💸",
    href: "/financas",
    cor: "var(--color-coral)",
    valor: formatBRL(atual),
    contexto: "gasto neste mês",
    pct: variacao(atual, anterior),
    upIsBad: true,
    serie,
    descricao: "Total gasto no mês, incluindo assinaturas, comparado ao mês anterior.",
    detalhe:
      detalhe.length > 0
        ? detalhe
        : [{ label: "Sem gastos registrados", valor: formatBRL(0) }],
    total: { label: "Total do mês", valor: formatBRL(atual) },
  };
}

// ---------- Treinos: sessões no mês (6 meses de série) ----------

async function areaTreinos(userId: string, ref: Date): Promise<AreaEvolucaoView> {
  const meses = eachMonthOfInterval({
    start: spStartOfMonth(subMonths(toSP(ref), 5)),
    end: spStartOfMonth(ref),
  });
  const inicioTotal = spStartOfMonth(meses[0]);
  const fimTotal = spEndOfMonth(ref);

  // 1 query por tabela cobrindo os 6 meses (em vez de 2 counts por mês) — bucketiza em memória.
  const [sessoes, runs, resumo] = await Promise.all([
    db.workoutSession.findMany({
      where: { userId, data: { gte: inicioTotal, lte: fimTotal } },
      select: { data: true },
    }),
    db.run.findMany({
      where: { userId, data: { gte: inicioTotal, lte: fimTotal } },
      select: { data: true },
    }),
    resumoTreinos(userId, ref),
  ]);

  const contagens = meses.map((m) => {
    const inicio = spStartOfMonth(m);
    const fim = spEndOfMonth(m);
    const s = sessoes.filter((x) => x.data >= inicio && x.data <= fim).length;
    const r = runs.filter((x) => x.data >= inicio && x.data <= fim).length;
    return s + r;
  });

  const atual = contagens.at(-1) ?? 0;
  const anterior = contagens.at(-2) ?? 0;

  const detalhe: LinhaDetalhe[] = [
    {
      label: "Meta do mês",
      valor: `${resumo.treinosMes} / ${resumo.metaMes}`,
      hint: `${Math.round(resumo.pctMeta)}%`,
      cor: "var(--color-mint)",
      share: Math.min(1, resumo.pctMeta / 100),
    },
    {
      label: "Sequência atual",
      valor: `${resumo.streak} ${resumo.streak === 1 ? "dia" : "dias"}`,
      cor: "var(--cal-amber)",
    },
    {
      label: "Km na semana",
      valor: `${resumo.kmSemana.toFixed(1)} km`,
      cor: "var(--cal-teal)",
    },
  ];
  if (resumo.porGrupo[0]) {
    detalhe.push({
      label: `Mais treinado · ${resumo.porGrupo[0].grupo}`,
      valor: `${resumo.porGrupo[0].series} séries`,
      cor: "var(--cal-lilac)",
    });
  }

  return {
    key: "treinos",
    nome: "Treinos",
    emoji: "🏋️",
    href: "/treinos",
    cor: "var(--color-mint)",
    valor: `${resumo.treinosMes}`,
    contexto: `de ${resumo.metaMes} · meta do mês`,
    pct: variacao(atual, anterior),
    serie: contagens,
    descricao: "Sessões de musculação e corrida concluídas no mês, ante o mês anterior.",
    detalhe,
    total: { label: "Progresso da meta", valor: `${Math.round(resumo.pctMeta)}%` },
  };
}

// ---------- Dieta: aderência 7d + peso ----------

async function areaDieta(userId: string, ref: Date): Promise<AreaEvolucaoView> {
  const [aderencia, peso] = await Promise.all([
    aderencia7d(userId, ref),
    evolucaoPeso(userId, ref),
  ]);

  // série de aderência aproximada: usa a curva de peso não faz sentido aqui;
  // mostramos a aderência como barra única e o peso como contexto rico.
  const seriePeso = peso.pontos.slice(-8).map((p) => p.peso);

  const detalhe: LinhaDetalhe[] = [
    {
      label: "Aderência (7 dias)",
      valor: `${Math.round(aderencia)}%`,
      cor: "var(--color-mint)",
      share: aderencia / 100,
    },
  ];
  if (peso.atual != null) {
    detalhe.push({
      label: "Peso atual",
      valor: `${peso.atual.toFixed(1)} kg`,
      cor: "var(--cal-teal)",
      hint: peso.alvo ? `meta ${peso.alvo} kg` : undefined,
    });
    const faltam = peso.atual - peso.alvo;
    detalhe.push({
      label: faltam > 0 ? "Falta para a meta" : "Abaixo da meta",
      valor: `${Math.abs(faltam).toFixed(1)} kg`,
      cor: "var(--cal-amber)",
    });
  }

  return {
    key: "dieta",
    nome: "Dieta",
    emoji: "🥗",
    href: "/dieta",
    cor: "var(--color-mint)",
    valor: `${Math.round(aderencia)}%`,
    contexto: "aderência · últimos 7 dias",
    // variação de peso nos 30 dias como sinal (perder peso ↘ é bom aqui)
    pct: peso.variacao30d,
    upIsBad: true,
    serie: seriePeso.length > 1 ? seriePeso : [aderencia],
    descricao: "Refeições cumpridas nos últimos 7 dias e evolução do seu peso.",
    detalhe,
    total:
      peso.atual != null
        ? { label: "Peso atual", valor: `${peso.atual.toFixed(1)} kg` }
        : undefined,
  };
}

// ---------- Estudos: horas na semana ----------

async function areaEstudos(userId: string, ref: Date): Promise<AreaEvolucaoView> {
  const dash = await dashboardEstudos(userId, ref);

  // série: horas por dia dos últimos 8 dias (a partir dos 14 do dashboard)
  const serie = dash.porDia.slice(-8).map((d) => Number(d.horas.toFixed(2)));
  const horasSemana = dash.totalSemanaHoras;
  const mediaSemanal = dash.mediaSemanalHoras;

  const fmtHoras = (h: number) => {
    const horas = Math.floor(h);
    const min = Math.round((h - horas) * 60);
    return min > 0 ? `${horas}h${String(min).padStart(2, "0")}` : `${horas}h`;
  };

  const detalhe: LinhaDetalhe[] = [
    {
      label: "Esta semana",
      valor: fmtHoras(horasSemana),
      cor: "var(--color-mint)",
    },
    {
      label: "Média semanal",
      valor: fmtHoras(mediaSemanal),
      cor: "var(--cal-teal)",
    },
    {
      label: "Sequência de estudo",
      valor: `${dash.streak} ${dash.streak === 1 ? "dia" : "dias"}`,
      cor: "var(--cal-amber)",
    },
  ];
  for (const a of dash.porAssunto.slice(0, 2)) {
    detalhe.push({
      label: a.subject,
      valor: fmtHoras(a.segundos / 3600),
      cor: "var(--cal-lilac)",
    });
  }

  return {
    key: "estudos",
    nome: "Estudos",
    emoji: "📚",
    href: "/estudos",
    cor: "var(--cal-teal)",
    valor: fmtHoras(horasSemana),
    contexto: "estudadas nesta semana",
    pct: variacao(horasSemana, mediaSemanal),
    serie: serie.length > 1 ? serie : [horasSemana],
    descricao: "Horas líquidas de estudo nesta semana, comparadas à sua média semanal.",
    detalhe,
    total: { label: "Total nesta semana", valor: fmtHoras(horasSemana) },
  };
}

// ---------- Investimentos: patrimônio + rendimento do mês ----------

async function areaInvestimentos(
  userId: string,
  ref: Date
): Promise<AreaEvolucaoView> {
  const carteira = await resumoCarteira(userId, ref);

  const serie = carteira.porClasse.map((c) => c.valor); // proporção por classe
  const detalhe: LinhaDetalhe[] = [
    {
      label: "Patrimônio",
      valor: formatBRL(carteira.patrimonio),
      cor: "var(--cal-amber)",
    },
    {
      label: "Rendimento do mês",
      valor: formatBRL(carteira.rendimentoMes),
      cor:
        carteira.rendimentoMes >= 0
          ? "var(--color-mint)"
          : "var(--color-coral)",
      hint:
        carteira.pctRendimentoMes != null
          ? `${carteira.pctRendimentoMes >= 0 ? "+" : ""}${carteira.pctRendimentoMes.toFixed(1)}%`
          : undefined,
    },
    {
      label: "Rendimento total",
      valor: formatBRL(carteira.rendimento),
      cor: carteira.rendimento >= 0 ? "var(--color-mint)" : "var(--color-coral)",
      hint:
        carteira.pctRendimento != null
          ? `${carteira.pctRendimento >= 0 ? "+" : ""}${carteira.pctRendimento.toFixed(1)}%`
          : undefined,
    },
    {
      label: "Dividendos",
      valor: formatBRL(carteira.dividendos),
      cor: "var(--cal-lilac)",
    },
  ];

  return {
    key: "investimentos",
    nome: "Investimentos",
    emoji: "📈",
    href: "/investimentos",
    cor: "var(--cal-amber)",
    valor: formatBRLCompact(carteira.patrimonio),
    contexto: "patrimônio investido",
    pct: carteira.pctRendimentoMes,
    serie: serie.length > 1 ? serie : [carteira.patrimonio],
    descricao: "Total investido e o rendimento acumulado no mês.",
    detalhe,
    total: { label: "Patrimônio", valor: formatBRL(carteira.patrimonio) },
  };
}

/**
 * Evolução consolidada das 5 áreas do sistema para o painel da página de Metas.
 * Reusa as funções cacheadas de cada módulo; o wrapper converte o ref de request
 * em chave estável por dia antes de delegar à interna "use cache".
 */
export async function evolucaoAreas(
  userId: string,
  ref: Date = new Date()
): Promise<AreaEvolucaoView[]> {
  return evolucaoAreasDoDia(userId, dayKeySP(ref));
}

async function evolucaoAreasDoDia(
  userId: string,
  dia: string
): Promise<AreaEvolucaoView[]> {
  "use cache";
  cacheTag(
    tagUsuario(userId, "financas"),
    tagUsuario(userId, "treinos"),
    tagUsuario(userId, "dieta"),
    tagUsuario(userId, "estudos"),
    tagUsuario(userId, "investimentos"),
    tagUsuario(userId, "settings"),
    tagUsuario(userId, "metas")
  );
  cacheLife("usuario");

  const ref = refDoDiaSP(dia);
  return Promise.all([
    areaFinancas(userId, ref),
    areaTreinos(userId, ref),
    areaDieta(userId, ref),
    areaEstudos(userId, ref),
    areaInvestimentos(userId, ref),
  ]);
}

/** Rótulo curto de mês (usado no cabeçalho do painel). */
export function rotuloMes(ref: Date): string {
  return monthName(ref);
}
