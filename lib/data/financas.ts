import { getDate, getDaysInMonth, subMonths } from "date-fns";
import { db } from "@/lib/db";
import {
  nowSP,
  spEndOfMonth,
  spStartOfMonth,
  toSP,
} from "@/lib/dates";
import type { RitmoPoint } from "@/components/charts/ritmo-chart";

/** Soma de despesas (centavos) num intervalo. */
export async function somaDespesas(from: Date, to: Date): Promise<number> {
  const agg = await db.transaction.aggregate({
    where: { tipo: "despesa", data: { gte: from, lte: to } },
    _sum: { valor: true },
  });
  return agg._sum.valor ?? 0;
}

export type ResumoMes = {
  gastoMes: number;
  gastoMesAnterior: number;
  /** variação % do total (null se mês anterior zerado) */
  pct: number | null;
  /** acumulado até hoje vs mesmo dia do mês anterior */
  acumuladoHoje: number;
  acumuladoAnteriorMesmoDia: number;
  pctRitmo: number | null;
  topCategoria: { nome: string; emoji: string; total: number } | null;
};

export async function resumoDoMes(ref: Date = new Date()): Promise<ResumoMes> {
  const iniMes = spStartOfMonth(ref);
  const fimMes = spEndOfMonth(ref);
  const refAnterior = subMonths(toSP(ref), 1);
  const iniAnt = spStartOfMonth(refAnterior);
  const fimAnt = spEndOfMonth(refAnterior);

  const diaHoje = getDate(toSP(ref));
  const mesmoDiaAnterior = new Date(
    Math.min(
      iniAnt.getTime() + diaHoje * 24 * 3600 * 1000 - 1,
      fimAnt.getTime()
    )
  );

  const [gastoMes, gastoMesAnterior, acumuladoAnteriorMesmoDia, porCategoria] =
    await Promise.all([
      somaDespesas(iniMes, fimMes),
      somaDespesas(iniAnt, fimAnt),
      somaDespesas(iniAnt, mesmoDiaAnterior),
      db.transaction.groupBy({
        by: ["categoryId"],
        where: { tipo: "despesa", data: { gte: iniMes, lte: fimMes } },
        _sum: { valor: true },
        orderBy: { _sum: { valor: "desc" } },
        take: 1,
      }),
    ]);

  let topCategoria: ResumoMes["topCategoria"] = null;
  if (porCategoria[0]?.categoryId) {
    const cat = await db.category.findUnique({
      where: { id: porCategoria[0].categoryId },
    });
    if (cat)
      topCategoria = {
        nome: cat.nome,
        emoji: cat.emoji,
        total: porCategoria[0]._sum.valor ?? 0,
      };
  }

  return {
    gastoMes,
    gastoMesAnterior,
    pct:
      gastoMesAnterior > 0
        ? ((gastoMes - gastoMesAnterior) / gastoMesAnterior) * 100
        : null,
    acumuladoHoje: gastoMes,
    acumuladoAnteriorMesmoDia,
    pctRitmo:
      acumuladoAnteriorMesmoDia > 0
        ? ((gastoMes - acumuladoAnteriorMesmoDia) / acumuladoAnteriorMesmoDia) *
          100
        : null,
    topCategoria,
  };
}

/** Série do gráfico Ritmo de gastos: acumulado dia a dia + projeção. */
export async function ritmoDeGastos(ref: Date = new Date()): Promise<{
  data: RitmoPoint[];
  acima: boolean;
}> {
  const refSP = toSP(ref);
  const refAnterior = subMonths(refSP, 1);
  const diaHoje = getDate(refSP);
  const diasAtual = getDaysInMonth(refSP);
  const diasAnterior = getDaysInMonth(refAnterior);

  const [txAtual, txAnterior] = await Promise.all([
    db.transaction.findMany({
      where: {
        tipo: "despesa",
        data: { gte: spStartOfMonth(ref), lte: spEndOfMonth(ref) },
      },
      select: { valor: true, data: true },
    }),
    db.transaction.findMany({
      where: {
        tipo: "despesa",
        data: {
          gte: spStartOfMonth(refAnterior),
          lte: spEndOfMonth(refAnterior),
        },
      },
      select: { valor: true, data: true },
    }),
  ]);

  const porDia = (txs: { valor: number; data: Date }[]) => {
    const map = new Map<number, number>();
    for (const tx of txs) {
      const d = getDate(toSP(tx.data));
      map.set(d, (map.get(d) ?? 0) + tx.valor);
    }
    return map;
  };

  const diaAtual = porDia(txAtual);
  const diaAnterior = porDia(txAnterior);

  const maxDias = Math.max(diasAtual, diasAnterior);
  const data: RitmoPoint[] = [];
  let accAtual = 0;
  let accAnterior = 0;
  let acumHoje = 0;

  for (let d = 1; d <= maxDias; d++) {
    accAtual += diaAtual.get(d) ?? 0;
    accAnterior += diaAnterior.get(d) ?? 0;
    if (d === diaHoje) acumHoje = accAtual;
    data.push({
      dia: d,
      atual: d <= diaHoje && d <= diasAtual ? accAtual : null,
      anterior: d <= diasAnterior ? accAnterior : null,
      projecao: null,
    });
  }

  // projeção linear do ritmo atual até o fim do mês
  const mediaDiaria = diaHoje > 0 ? acumHoje / diaHoje : 0;
  for (let d = diaHoje; d <= diasAtual; d++) {
    const point = data[d - 1];
    point.projecao =
      d === diaHoje ? acumHoje : Math.round(acumHoje + mediaDiaria * (d - diaHoje));
  }

  const anteriorMesmoDia =
    data[Math.min(diaHoje, diasAnterior) - 1]?.anterior ?? 0;

  return { data, acima: acumHoje > (anteriorMesmoDia ?? 0) };
}

export type CategoriaComparada = {
  id: string;
  nome: string;
  emoji: string;
  cor: string;
  atual: number;
  anterior: number;
  orcamentoMensal: number | null;
};

/** Soma por categoria no mês atual e anterior (para insights e top categorias). */
export async function categoriasComparadas(
  ref: Date = new Date()
): Promise<CategoriaComparada[]> {
  const refAnterior = subMonths(toSP(ref), 1);
  const [cats, atual, anterior] = await Promise.all([
    db.category.findMany({ where: { tipo: "despesa" } }),
    db.transaction.groupBy({
      by: ["categoryId"],
      where: {
        tipo: "despesa",
        data: { gte: spStartOfMonth(ref), lte: spEndOfMonth(ref) },
      },
      _sum: { valor: true },
    }),
    db.transaction.groupBy({
      by: ["categoryId"],
      where: {
        tipo: "despesa",
        data: {
          gte: spStartOfMonth(refAnterior),
          lte: spEndOfMonth(refAnterior),
        },
      },
      _sum: { valor: true },
    }),
  ]);

  const mapAtual = new Map(atual.map((g) => [g.categoryId, g._sum.valor ?? 0]));
  const mapAnterior = new Map(
    anterior.map((g) => [g.categoryId, g._sum.valor ?? 0])
  );

  return cats
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      emoji: c.emoji,
      cor: c.cor,
      atual: mapAtual.get(c.id) ?? 0,
      anterior: mapAnterior.get(c.id) ?? 0,
      orcamentoMensal: c.orcamentoMensal,
    }))
    .sort((a, b) => b.atual - a.atual);
}
