import { addDays, getDate, getDaysInMonth, subMonths } from "date-fns";
import { db } from "@/lib/db";
import {
  dayKeySP,
  monthKeySP,
  monthName,
  spEndOfDay,
  spEndOfMonth,
  spStartOfDay,
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

// ---------- Contas ----------

export type ContaComSaldo = {
  id: string;
  nome: string;
  tipo: string;
  cor: string;
  saldo: number;
};

/** Saldo = inicial + receitas − despesas − transferências saindo + transferências entrando. */
export async function contasComSaldo(): Promise<ContaComSaldo[]> {
  const [contas, txs] = await Promise.all([
    db.account.findMany({ orderBy: { criadoEm: "asc" } }),
    db.transaction.findMany({
      select: { tipo: true, valor: true, accountId: true, contraAccountId: true },
    }),
  ]);

  const saldos = new Map(contas.map((c) => [c.id, c.saldoInicial]));
  const add = (id: string | null, delta: number) => {
    if (!id) return;
    const atual = saldos.get(id);
    if (atual !== undefined) saldos.set(id, atual + delta);
  };

  for (const tx of txs) {
    if (tx.tipo === "receita") add(tx.accountId, tx.valor);
    else if (tx.tipo === "despesa") add(tx.accountId, -tx.valor);
    else {
      add(tx.accountId, -tx.valor);
      add(tx.contraAccountId, tx.valor);
    }
  }

  return contas.map((c) => ({
    id: c.id,
    nome: c.nome,
    tipo: c.tipo,
    cor: c.cor,
    saldo: saldos.get(c.id) ?? c.saldoInicial,
  }));
}

// ---------- Cartões ----------

export type FaturaCartao = {
  id: string;
  nome: string;
  bandeira: string;
  cor: string;
  limite: number;
  fechamento: number;
  vencimento: number;
  /** total do ciclo aberto */
  faturaAberta: number;
  /** soma de tudo que ainda não foi para uma fatura fechada */
  utilizado: number;
  pctLimite: number;
};

/** Ciclo aberto = do último fechamento (exclusivo) até agora. */
export async function faturasDosCartoes(
  ref: Date = new Date()
): Promise<FaturaCartao[]> {
  const refSP = toSP(ref);
  const [cards, txs] = await Promise.all([
    db.card.findMany(),
    db.transaction.findMany({
      where: { cardId: { not: null }, tipo: "despesa" },
      select: { valor: true, data: true, cardId: true },
    }),
  ]);

  return cards.map((card) => {
    const diaHoje = getDate(refSP);
    const inicioCiclo =
      diaHoje > card.fechamento
        ? new Date(refSP.getFullYear(), refSP.getMonth(), card.fechamento + 1)
        : new Date(refSP.getFullYear(), refSP.getMonth() - 1, card.fechamento + 1);

    const doCartao = txs.filter((t) => t.cardId === card.id);
    const faturaAberta = doCartao
      .filter((t) => toSP(t.data) >= toSP(inicioCiclo))
      .reduce((s, t) => s + t.valor, 0);
    const utilizado = doCartao.reduce((s, t) => s + t.valor, 0);

    return {
      id: card.id,
      nome: card.nome,
      bandeira: card.bandeira,
      cor: card.cor,
      limite: card.limite,
      fechamento: card.fechamento,
      vencimento: card.vencimento,
      faturaAberta,
      utilizado,
      pctLimite: card.limite > 0 ? (faturaAberta / card.limite) * 100 : 0,
    };
  });
}

// ---------- Fluxo de caixa ----------

export type FluxoMes = {
  label: string;
  receita: number;
  despesa: number;
  saldo: number;
};

/** Receita × despesa dos últimos N meses (inclui o mês de referência). */
export async function fluxoDeCaixa(
  meses = 6,
  ref: Date = new Date()
): Promise<FluxoMes[]> {
  const inicio = spStartOfMonth(subMonths(toSP(ref), meses - 1));
  const fim = spEndOfMonth(ref);

  const txs = await db.transaction.findMany({
    where: { data: { gte: inicio, lte: fim }, tipo: { in: ["receita", "despesa"] } },
    select: { tipo: true, valor: true, data: true },
  });

  const out: FluxoMes[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const mesRef = subMonths(toSP(ref), i);
    const chave = monthKeySP(mesRef);
    const doMes = txs.filter((t) => monthKeySP(toSP(t.data)) === chave);
    const receita = doMes
      .filter((t) => t.tipo === "receita")
      .reduce((s, t) => s + t.valor, 0);
    const despesa = doMes
      .filter((t) => t.tipo === "despesa")
      .reduce((s, t) => s + t.valor, 0);
    out.push({
      label: monthName(mesRef).slice(0, 3),
      receita,
      despesa,
      saldo: receita - despesa,
    });
  }
  return out;
}

// ---------- Gastos por dia (heatmap) ----------

export async function gastosPorDiaDoMes(
  ref: Date = new Date()
): Promise<{ dia: number; valor: number }[]> {
  const txs = await db.transaction.findMany({
    where: {
      tipo: "despesa",
      data: { gte: spStartOfMonth(ref), lte: spEndOfMonth(ref) },
    },
    select: { valor: true, data: true },
  });

  const dias = getDaysInMonth(toSP(ref));
  const map = new Map<number, number>();
  for (const tx of txs) {
    const d = getDate(toSP(tx.data));
    map.set(d, (map.get(d) ?? 0) + tx.valor);
  }
  return Array.from({ length: dias }, (_, i) => ({
    dia: i + 1,
    valor: map.get(i + 1) ?? 0,
  }));
}

// ---------- Próximos vencimentos ----------

export type Vencimento = {
  id: string;
  titulo: string;
  emoji: string;
  data: Date;
  valor: number;
  origem: "assinatura" | "parcela";
};

/** Assinaturas e parcelas a vencer nos próximos N dias. */
export async function proximosVencimentos(
  dias = 7,
  ref: Date = new Date()
): Promise<Vencimento[]> {
  const de = spStartOfDay(ref);
  const ate = spEndOfDay(addDays(toSP(ref), dias));

  const [assinaturas, parcelas] = await Promise.all([
    db.subscription.findMany({ where: { status: "ativa" } }),
    db.transaction.findMany({
      where: {
        parcelaGrupo: { not: null },
        data: { gte: de, lte: ate },
      },
      select: {
        id: true,
        descricao: true,
        valor: true,
        data: true,
        parcelaNum: true,
        parcelaTotal: true,
      },
    }),
  ]);

  const out: Vencimento[] = parcelas.map((p) => ({
    id: p.id,
    titulo: `${p.descricao} ${p.parcelaNum}/${p.parcelaTotal}`,
    emoji: "🧾",
    data: p.data,
    valor: p.valor,
    origem: "parcela" as const,
  }));

  for (const a of assinaturas) {
    for (let i = 0; i <= dias; i++) {
      const dia = addDays(toSP(ref), i);
      if (getDate(dia) !== a.diaCobranca) continue;
      out.push({
        id: `${a.id}-${dayKeySP(dia)}`,
        titulo: a.nome,
        emoji: a.emoji,
        data: spStartOfDay(dia),
        valor: a.valor,
        origem: "assinatura",
      });
    }
  }

  return out.sort((a, b) => a.data.getTime() - b.data.getTime());
}

// ---------- Parcelamentos ----------

export type Parcelamento = {
  grupo: string;
  descricao: string;
  valorParcela: number;
  total: number;
  pagas: number;
  parcelas: number;
  proxima: Date | null;
};

export async function parcelamentos(ref: Date = new Date()): Promise<Parcelamento[]> {
  const txs = await db.transaction.findMany({
    where: { parcelaGrupo: { not: null } },
    orderBy: { data: "asc" },
  });

  const grupos = new Map<string, typeof txs>();
  for (const tx of txs) {
    const g = tx.parcelaGrupo!;
    grupos.set(g, [...(grupos.get(g) ?? []), tx]);
  }

  const hoje = spEndOfDay(ref);
  return Array.from(grupos.entries())
    .map(([grupo, itens]) => {
      const pagas = itens.filter((t) => t.data <= hoje).length;
      const proxima = itens.find((t) => t.data > hoje)?.data ?? null;
      return {
        grupo,
        descricao: itens[0].descricao,
        valorParcela: itens[0].valor,
        total: itens.reduce((s, t) => s + t.valor, 0),
        pagas,
        parcelas: itens[0].parcelaTotal ?? itens.length,
        proxima,
      };
    })
    .filter((p) => p.pagas < p.parcelas)
    .sort((a, b) => (a.proxima?.getTime() ?? 0) - (b.proxima?.getTime() ?? 0));
}
