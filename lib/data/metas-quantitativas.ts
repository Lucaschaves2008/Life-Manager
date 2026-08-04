import { db } from "@/lib/db";
import { parseJSON } from "@/lib/utils";
import {
  fmtSP,
  refDoAnoSP,
  refDoMesSP,
  refDoTrimestreSP,
  spAddMonths,
  spEndOfMonth,
  spEndOfQuarter,
  spEndOfYear,
  spStartOfMonth,
  spStartOfQuarter,
  spStartOfYear,
} from "@/lib/dates";
import { contarOcorrenciasEmLote } from "@/lib/data/variaveis";
import {
  METRICAS,
  PERIODOS,
  REGISTROS_VAZIOS,
  calcularMetrica,
  contarCardio,
  type MetaMetrica,
  type MetaOrigem,
  type MetaPeriodo,
  type RegistrosDoPeriodo,
} from "@/lib/data/metas-quantitativas-constantes";
import type { ModalidadeCardio } from "@/lib/data/treinos-format";

/**
 * Metas quantitativas: alvo numérico com progresso calculado automaticamente
 * a partir de dados que já existem em outros módulos — sem contador manual.
 */

export { METRICAS, PERIODOS };
export type { MetaMetrica, MetaOrigem, MetaPeriodo };

export type MetaQuantitativaView = {
  id: string;
  titulo: string;
  origem: MetaOrigem;
  metrica: MetaMetrica | null;
  variavelId: string | null;
  unidade: string;
  alvo: number;
  atual: number;
  pct: number; // atual/alvo * 100, sem clamp (a UI decide como exibir o excesso)
  periodo: MetaPeriodo;
  chave: string;
  periodoLabel: string;
  diasRestantes: number;
  noPrazo: boolean;
};

/** Converte (periodo, chave) num range de datas estável — único lugar que sabe fazer essa conta. */
function rangeDoPeriodo(periodo: MetaPeriodo, chave: string): { inicio: Date; fim: Date } {
  if (periodo === "mes") {
    const ref = refDoMesSP(chave);
    return { inicio: spStartOfMonth(ref), fim: spEndOfMonth(ref) };
  }
  if (periodo === "trimestre") {
    const ref = refDoTrimestreSP(chave);
    return { inicio: spStartOfQuarter(ref), fim: spEndOfQuarter(ref) };
  }
  if (periodo === "trimestre_movel") {
    // Janela de 3 meses de calendário começando no mês salvo em `chave`
    // ("yyyy-MM") — não o trimestre civil (jan-mar/abr-jun/...), mas os 3
    // meses a partir de quando a meta foi criada.
    const ref = refDoMesSP(chave);
    return { inicio: spStartOfMonth(ref), fim: spEndOfMonth(spAddMonths(ref, 2)) };
  }
  const ref = refDoAnoSP(chave);
  return { inicio: spStartOfYear(ref), fim: spEndOfYear(ref) };
}

function periodoLabelDe(periodo: MetaPeriodo, chave: string): string {
  if (periodo === "mes") {
    const { inicio } = rangeDoPeriodo(periodo, chave);
    return inicio.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
  }
  if (periodo === "trimestre") {
    const [ano, q] = chave.split("-Q");
    return `${q}º trimestre de ${ano}`;
  }
  if (periodo === "trimestre_movel") {
    const { inicio, fim } = rangeDoPeriodo(periodo, chave);
    return `${fmtSP(inicio, "MMM")} – ${fmtSP(fim, "MMM 'de' yyyy")}`;
  }
  return chave;
}

/** Qual modalidade de cardio cada métrica de cardio observa. */
const MODALIDADE_DA_METRICA = {
  corridas_completas: "corrida",
  km_corridos: "corrida",
  natacoes_completas: "natacao",
  metros_nadados: "natacao",
  pedaladas_completas: "ciclismo",
  km_pedalados: "ciclismo",
} as const satisfies Partial<Record<MetaMetrica, ModalidadeCardio>>;

/** Contagem de sessões numa modalidade, no campo que calcularMetrica espera. */
function contagemDe(
  modalidade: ModalidadeCardio,
  sessoes: number
): Pick<RegistrosDoPeriodo, "corridas" | "natacoes" | "pedaladas"> {
  return {
    corridas: modalidade === "corrida" ? sessoes : 0,
    natacoes: modalidade === "natacao" ? sessoes : 0,
    pedaladas: modalidade === "ciclismo" ? sessoes : 0,
  };
}

/** Distância (km) numa modalidade, no campo que calcularMetrica espera. */
function distanciaDe(
  modalidade: ModalidadeCardio,
  km: number
): Pick<RegistrosDoPeriodo, "km" | "kmNatacao" | "kmCiclismo"> {
  return {
    km: modalidade === "corrida" ? km : 0,
    kmNatacao: modalidade === "natacao" ? km : 0,
    kmCiclismo: modalidade === "ciclismo" ? km : 0,
  };
}

/**
 * Progresso atual de uma métrica automática no período.
 *
 * Só busca o que a métrica pedida precisa (não carrega todas as fontes à toa) e
 * delega a fórmula para calcularMetrica() — a mesma usada por Desafios
 * (lib/data/desafios.ts), para os dois caminhos nunca divergirem.
 */
export async function calcularAtual(
  userId: string,
  metrica: MetaMetrica,
  inicio: Date,
  fim: Date
): Promise<number> {
  const vazio = REGISTROS_VAZIOS;

  switch (metrica) {
    case "treinos": {
      const [treinos, cardio] = await Promise.all([
        db.workoutSession.count({ where: { userId, data: { gte: inicio, lte: fim } } }),
        db.run.findMany({
          where: { userId, data: { gte: inicio, lte: fim } },
          select: { modalidade: true },
        }),
      ]);
      return calcularMetrica(metrica, {
        ...vazio,
        treinos,
        ...contarCardio(cardio),
      });
    }
    case "corridas_completas":
    case "natacoes_completas":
    case "pedaladas_completas": {
      const modalidade = MODALIDADE_DA_METRICA[metrica];
      const sessoes = await db.run.count({
        where: { userId, modalidade, data: { gte: inicio, lte: fim } },
      });
      return calcularMetrica(metrica, { ...vazio, ...contagemDe(modalidade, sessoes) });
    }
    case "km_corridos":
    case "metros_nadados":
    case "km_pedalados": {
      const modalidade = MODALIDADE_DA_METRICA[metrica];
      const agg = await db.run.aggregate({
        where: { userId, modalidade, data: { gte: inicio, lte: fim } },
        _sum: { km: true },
      });
      return calcularMetrica(metrica, {
        ...vazio,
        ...distanciaDe(modalidade, agg._sum.km ?? 0),
      });
    }
    case "refeicoes_cumpridas": {
      const logs = await db.dietDayLog.findMany({
        where: { userId, data: { gte: inicio, lte: fim } },
        select: { refeicoesCumpridas: true },
      });
      const refeicoesCumpridas = logs.reduce(
        (s, log) => s + parseJSON<string[]>(log.refeicoesCumpridas, []).length,
        0
      );
      return calcularMetrica(metrica, { ...vazio, refeicoesCumpridas });
    }
    case "horas_estudo": {
      const sessoes = await db.studySession.findMany({
        where: { userId, startedAt: { gte: inicio, lte: fim }, endedAt: { not: null } },
        select: { netSeconds: true },
      });
      const segundosEstudo = sessoes.reduce((s, x) => s + x.netSeconds, 0);
      return calcularMetrica(metrica, { ...vazio, segundosEstudo });
    }
    case "dinheiro": {
      const agg = await db.dinheiroLancamento.aggregate({
        where: { userId, data: { gte: inicio, lte: fim } },
        _sum: { valor: true },
      });
      return calcularMetrica(metrica, { ...vazio, dinheiroCentavos: agg._sum.valor ?? 0 });
    }
  }
}

/**
 * Progresso de todas as metas cuja métrica é `metrica`, calculado com 1 leva de
 * queries (cobrindo a união dos ranges de todas as metas dessa métrica) em vez
 * de 1-2 queries por meta — evita N+1 quando o usuário tem várias metas.
 */
async function calcularAtualEmLote(
  userId: string,
  metrica: MetaMetrica,
  metas: { inicio: Date; fim: Date }[]
): Promise<number[]> {
  const inicioTotal = new Date(Math.min(...metas.map((m) => m.inicio.getTime())));
  const fimTotal = new Date(Math.max(...metas.map((m) => m.fim.getTime())));
  const dentro = (d: Date, inicio: Date, fim: Date) => d >= inicio && d <= fim;

  const vazio = REGISTROS_VAZIOS;

  switch (metrica) {
    case "treinos": {
      const [sessoes, runs] = await Promise.all([
        db.workoutSession.findMany({
          where: { userId, data: { gte: inicioTotal, lte: fimTotal } },
          select: { data: true },
        }),
        db.run.findMany({
          where: { userId, data: { gte: inicioTotal, lte: fimTotal } },
          select: { data: true, modalidade: true },
        }),
      ]);
      return metas.map(({ inicio, fim }) =>
        calcularMetrica(metrica, {
          ...vazio,
          treinos: sessoes.filter((s) => dentro(s.data, inicio, fim)).length,
          ...contarCardio(runs.filter((r) => dentro(r.data, inicio, fim))),
        })
      );
    }
    case "corridas_completas":
    case "natacoes_completas":
    case "pedaladas_completas": {
      const modalidade = MODALIDADE_DA_METRICA[metrica];
      const runs = await db.run.findMany({
        where: { userId, modalidade, data: { gte: inicioTotal, lte: fimTotal } },
        select: { data: true },
      });
      return metas.map(({ inicio, fim }) =>
        calcularMetrica(metrica, {
          ...vazio,
          ...contagemDe(modalidade, runs.filter((r) => dentro(r.data, inicio, fim)).length),
        })
      );
    }
    case "km_corridos":
    case "metros_nadados":
    case "km_pedalados": {
      const modalidade = MODALIDADE_DA_METRICA[metrica];
      const runs = await db.run.findMany({
        where: { userId, modalidade, data: { gte: inicioTotal, lte: fimTotal } },
        select: { data: true, km: true },
      });
      return metas.map(({ inicio, fim }) =>
        calcularMetrica(metrica, {
          ...vazio,
          ...distanciaDe(
            modalidade,
            runs.filter((r) => dentro(r.data, inicio, fim)).reduce((s, r) => s + r.km, 0)
          ),
        })
      );
    }
    case "refeicoes_cumpridas": {
      const logs = await db.dietDayLog.findMany({
        where: { userId, data: { gte: inicioTotal, lte: fimTotal } },
        select: { data: true, refeicoesCumpridas: true },
      });
      return metas.map(({ inicio, fim }) =>
        calcularMetrica(metrica, {
          ...vazio,
          refeicoesCumpridas: logs
            .filter((l) => dentro(l.data, inicio, fim))
            .reduce((s, l) => s + parseJSON<string[]>(l.refeicoesCumpridas, []).length, 0),
        })
      );
    }
    case "horas_estudo": {
      const sessoes = await db.studySession.findMany({
        where: { userId, startedAt: { gte: inicioTotal, lte: fimTotal }, endedAt: { not: null } },
        select: { startedAt: true, netSeconds: true },
      });
      return metas.map(({ inicio, fim }) =>
        calcularMetrica(metrica, {
          ...vazio,
          segundosEstudo: sessoes
            .filter((s) => dentro(s.startedAt, inicio, fim))
            .reduce((s, x) => s + x.netSeconds, 0),
        })
      );
    }
    case "dinheiro": {
      const lancamentos = await db.dinheiroLancamento.findMany({
        where: { userId, data: { gte: inicioTotal, lte: fimTotal } },
        select: { data: true, valor: true },
      });
      return metas.map(({ inicio, fim }) =>
        calcularMetrica(metrica, {
          ...vazio,
          dinheiroCentavos: lancamentos
            .filter((l) => dentro(l.data, inicio, fim))
            .reduce((s, l) => s + l.valor, 0),
        })
      );
    }
  }
}

/** Todas as metas quantitativas do usuário, com progresso calculado agora. */
export async function metasQuantitativas(
  userId: string,
  hoje: Date = new Date()
): Promise<MetaQuantitativaView[]> {
  const metas = await db.metaQuantitativa.findMany({
    where: { userId },
    orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
  });
  if (metas.length === 0) return [];

  const ranges = metas.map((m) => rangeDoPeriodo(m.periodo as MetaPeriodo, m.chave));
  const atuais = new Array<number>(metas.length);

  // origem="metrica": agrupa por métrica pra fazer 1 leva de queries por
  // métrica usada (não por meta).
  const indicesPorMetrica = new Map<MetaMetrica, number[]>();
  // origem="variavel": todas resolvidas juntas em 1 chamada (já em lote).
  const indicesVariavel: number[] = [];

  metas.forEach((m, i) => {
    if (m.origem === "variavel" && m.variavelId) {
      indicesVariavel.push(i);
      return;
    }
    const metrica = m.metrica as MetaMetrica;
    const lista = indicesPorMetrica.get(metrica) ?? [];
    lista.push(i);
    indicesPorMetrica.set(metrica, lista);
  });

  await Promise.all([
    ...[...indicesPorMetrica.entries()].map(async ([metrica, indices]) => {
      const valores = await calcularAtualEmLote(
        userId,
        metrica,
        indices.map((i) => ranges[i])
      );
      indices.forEach((i, k) => {
        atuais[i] = valores[k];
      });
    }),
    (async () => {
      if (indicesVariavel.length === 0) return;
      const valores = await contarOcorrenciasEmLote(
        userId,
        indicesVariavel.map((i) => ({
          variavelId: metas[i].variavelId!,
          inicio: ranges[i].inicio,
          fim: ranges[i].fim,
        }))
      );
      indicesVariavel.forEach((i, k) => {
        atuais[i] = valores[k];
      });
    })(),
  ]);

  return metas.map((m, i) => {
    const origem = (m.origem as MetaOrigem) ?? "metrica";
    const metrica = origem === "metrica" ? (m.metrica as MetaMetrica) : null;
    const periodo = m.periodo as MetaPeriodo;
    const { inicio, fim } = ranges[i];
    const atual = atuais[i];
    const pct = m.alvo > 0 ? (atual / m.alvo) * 100 : 0;

    const totalMs = fim.getTime() - inicio.getTime();
    const decorridoMs = Math.min(Math.max(hoje.getTime() - inicio.getTime(), 0), totalMs);
    const pctTempo = totalMs > 0 ? (decorridoMs / totalMs) * 100 : 100;
    const diasRestantes = Math.max(
      0,
      Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
    );
    const noPrazo = pct >= 100 || pct >= pctTempo;

    const unidade =
      origem === "metrica" ? METRICAS.find((met) => met.value === metrica)?.unidade ?? "" : "dias";

    return {
      id: m.id,
      titulo: m.titulo,
      origem,
      metrica,
      variavelId: m.variavelId,
      unidade,
      alvo: m.alvo,
      atual,
      pct,
      periodo,
      chave: m.chave,
      periodoLabel: periodoLabelDe(periodo, m.chave),
      diasRestantes,
      noPrazo,
    };
  });
}
