import { cache } from "react";
import {
  cacheLife,
  cacheTag,
} from "next/cache";
import { addDays, getDate, getDaysInMonth, subMonths } from "date-fns";
import { db } from "@/lib/db";
import { tagUsuario } from "@/lib/cache-tags";
import {
  dayKeySP,
  monthKeySP,
  monthName,
  refDoDiaSP,
  spEndOfDay,
  spEndOfMonth,
  spStartOfDay,
  spStartOfMonth,
  toSP,
} from "@/lib/dates";
import type { RitmoPoint } from "@/components/charts/ritmo-chart";
import { parseJSON } from "@/lib/utils";

// Padrão de cache deste arquivo (ver lib/data/home.ts): a função exportada
// mantém a assinatura original (contaFinanceiraId, ref?) e delega para uma interna
// "use cache" cujos argumentos são chaves ESTÁVEIS (dayKey/monthKey) — nunca
// um Date de request. Janela mensal → monthKey; sensível ao dia → dayKey.

/** Reconstrói uma ref no 1º dia do mês a partir da chave "yyyy-MM". */
function refDoMesSP(mes: string): Date {
  return refDoDiaSP(`${mes}-01`);
}

/**
 * Soma de despesas (centavos) num intervalo.
 * Não cacheada: from/to são instantes arbitrários (sem chave estável);
 * só é usada dentro de funções já cacheadas, então herda o cache delas.
 */
export async function somaDespesas(
  contaFinanceiraId: string,
  from: Date,
  to: Date
): Promise<number> {
  const agg = await db.transaction.aggregate({
    where: { contaFinanceiraId, tipo: "despesa", natureza: "despesa", data: { gte: from, lte: to } },
    _sum: { valor: true },
  });
  return agg._sum.valor ?? 0;
}

// ---------- Assinaturas como despesa mensal ----------

type AssinaturaAtiva = { valor: number; diaCobranca: number };

/**
 * Assinaturas ativas contam como despesa mensal em todas as agregações de
 * gastos (resumo, ritmo, heatmap, fluxo de caixa), mesmo sem existirem como
 * Transaction: uma cobrança por mês, no diaCobranca (limitado ao último dia
 * em meses mais curtos).
 */
async function assinaturasAtivas(contaFinanceiraId: string): Promise<AssinaturaAtiva[]> {
  return db.subscription.findMany({
    where: { contaFinanceiraId, status: "ativa" },
    select: { valor: true, diaCobranca: true },
  });
}

/** Soma das cobranças do mês; com `ateDia`, só as que caem até esse dia. */
function somaAssinaturas(
  assinaturas: AssinaturaAtiva[],
  diasNoMes: number,
  ateDia?: number
): number {
  let total = 0;
  for (const a of assinaturas) {
    const dia = Math.min(a.diaCobranca, diasNoMes);
    if (ateDia == null || dia <= ateDia) total += a.valor;
  }
  return total;
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

export const resumoDoMes = cache(async function resumoDoMes(
  contaFinanceiraId: string,
  ref: Date = new Date()
): Promise<ResumoMes> {
  // depende do "mesmo dia do mês anterior" → chave por dia
  return resumoDoDia(contaFinanceiraId, dayKeySP(ref));
});

async function resumoDoDia(contaFinanceiraId: string, dia: string): Promise<ResumoMes> {
  "use cache";
  cacheTag(tagUsuario(contaFinanceiraId, "financas"));
  cacheLife("usuario");

  const ref = refDoDiaSP(dia);
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

  const [gastoTx, gastoTxAnterior, acumuladoTxAnterior, porCategoria, assinaturas] =
    await Promise.all([
      somaDespesas(contaFinanceiraId, iniMes, fimMes),
      somaDespesas(contaFinanceiraId, iniAnt, fimAnt),
      somaDespesas(contaFinanceiraId, iniAnt, mesmoDiaAnterior),
      db.transaction.groupBy({
        by: ["categoryId"],
        where: { contaFinanceiraId, tipo: "despesa", natureza: "despesa", data: { gte: iniMes, lte: fimMes } },
        _sum: { valor: true },
        orderBy: { _sum: { valor: "desc" } },
        take: 1,
      }),
      assinaturasAtivas(contaFinanceiraId),
    ]);

  const diasMes = getDaysInMonth(toSP(ref));
  const diasMesAnterior = getDaysInMonth(refAnterior);
  const gastoMes = gastoTx + somaAssinaturas(assinaturas, diasMes);
  const gastoMesAnterior =
    gastoTxAnterior + somaAssinaturas(assinaturas, diasMesAnterior);
  const acumuladoHoje = gastoTx + somaAssinaturas(assinaturas, diasMes, diaHoje);
  const acumuladoAnteriorMesmoDia =
    acumuladoTxAnterior +
    somaAssinaturas(
      assinaturas,
      diasMesAnterior,
      Math.min(diaHoje, diasMesAnterior)
    );

  let topCategoria: ResumoMes["topCategoria"] = null;
  if (porCategoria[0]?.categoryId) {
    const cat = await db.category.findFirst({
      where: { id: porCategoria[0].categoryId, contaFinanceiraId },
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
    acumuladoHoje,
    acumuladoAnteriorMesmoDia,
    pctRitmo:
      acumuladoAnteriorMesmoDia > 0
        ? ((acumuladoHoje - acumuladoAnteriorMesmoDia) /
            acumuladoAnteriorMesmoDia) *
          100
        : null,
    topCategoria,
  };
}

/** Série do gráfico Ritmo de gastos: acumulado dia a dia + projeção. */
export async function ritmoDeGastos(
  contaFinanceiraId: string,
  ref: Date = new Date()
): Promise<{
  data: RitmoPoint[];
  acima: boolean;
}> {
  return ritmoDoDia(contaFinanceiraId, dayKeySP(ref));
}

async function ritmoDoDia(
  contaFinanceiraId: string,
  dia: string
): Promise<{ data: RitmoPoint[]; acima: boolean }> {
  "use cache";
  cacheTag(tagUsuario(contaFinanceiraId, "financas"));
  cacheLife("usuario");

  const ref = refDoDiaSP(dia);
  const refSP = toSP(ref);
  const refAnterior = subMonths(refSP, 1);
  const diaHoje = getDate(refSP);
  const diasAtual = getDaysInMonth(refSP);
  const diasAnterior = getDaysInMonth(refAnterior);

  const [txAtual, txAnterior, assinaturas] = await Promise.all([
    db.transaction.findMany({
      where: {
        contaFinanceiraId,
        tipo: "despesa",
        natureza: "despesa",
        data: { gte: spStartOfMonth(ref), lte: spEndOfMonth(ref) },
      },
      select: { valor: true, data: true },
    }),
    db.transaction.findMany({
      where: {
        contaFinanceiraId,
        tipo: "despesa",
        natureza: "despesa",
        data: {
          gte: spStartOfMonth(refAnterior),
          lte: spEndOfMonth(refAnterior),
        },
      },
      select: { valor: true, data: true },
    }),
    assinaturasAtivas(contaFinanceiraId),
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

  for (const a of assinaturas) {
    const dAtual = Math.min(a.diaCobranca, diasAtual);
    diaAtual.set(dAtual, (diaAtual.get(dAtual) ?? 0) + a.valor);
    const dAnt = Math.min(a.diaCobranca, diasAnterior);
    diaAnterior.set(dAnt, (diaAnterior.get(dAnt) ?? 0) + a.valor);
  }

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
export const categoriasComparadas = cache(async function categoriasComparadas(
  contaFinanceiraId: string,
  ref: Date = new Date()
): Promise<CategoriaComparada[]> {
  // janela mensal inteira → chave por mês
  return categoriasDoMes(contaFinanceiraId, monthKeySP(ref));
});

async function categoriasDoMes(
  contaFinanceiraId: string,
  mes: string
): Promise<CategoriaComparada[]> {
  "use cache";
  cacheTag(tagUsuario(contaFinanceiraId, "financas"));
  cacheLife("usuario");

  const ref = refDoMesSP(mes);
  const refAnterior = subMonths(toSP(ref), 1);
  const [cats, atual, anterior] = await Promise.all([
    db.category.findMany({ where: { contaFinanceiraId, tipo: "despesa" } }),
    db.transaction.groupBy({
      by: ["categoryId"],
      where: {
        contaFinanceiraId,
        tipo: "despesa",
        natureza: "despesa",
        data: { gte: spStartOfMonth(ref), lte: spEndOfMonth(ref) },
      },
      _sum: { valor: true },
    }),
    db.transaction.groupBy({
      by: ["categoryId"],
      where: {
        contaFinanceiraId,
        tipo: "despesa",
        natureza: "despesa",
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

// ---------- Assinaturas ativas (para detalhamento de despesas) ----------

export type AssinaturaResumo = {
  id: string;
  nome: string;
  emoji: string;
  /** cobrança mensal (centavos) */
  valor: number;
  diaCobranca: number;
};

/** Assinaturas ativas do usuário, ordenadas pela cobrança mensal. */
export async function assinaturasResumidas(
  contaFinanceiraId: string
): Promise<AssinaturaResumo[]> {
  "use cache";
  cacheTag(tagUsuario(contaFinanceiraId, "financas"));
  cacheLife("usuario");

  const subs = await db.subscription.findMany({
    where: { contaFinanceiraId, status: "ativa" },
    select: { id: true, nome: true, emoji: true, valor: true, diaCobranca: true },
    orderBy: { valor: "desc" },
  });
  return subs;
}

// ---------- Contas ----------

export type ContaComSaldo = {
  id: string;
  nome: string;
  tipo: string;
  cor: string;
  saldo: number;
};

/** Saldo = inicial + receitas − despesas − transferências saindo + transferências entrando (só ponta "conta"). */
export async function contasComSaldo(contaFinanceiraId: string): Promise<ContaComSaldo[]> {
  "use cache";
  cacheTag(tagUsuario(contaFinanceiraId, "financas"));
  cacheLife("usuario");

  const [contas, txs] = await Promise.all([
    db.account.findMany({ where: { contaFinanceiraId }, orderBy: { criadoEm: "asc" } }),
    db.transaction.findMany({
      where: { contaFinanceiraId },
      select: {
        tipo: true,
        valor: true,
        accountId: true,
        origemTipo: true,
        origemId: true,
        destinoTipo: true,
        destinoId: true,
      },
    }),
  ]);

  const saldos = new Map(contas.map((c) => [c.id, c.saldoInicial]));
  const add = (tipo: string | null, id: string | null, delta: number) => {
    if (tipo !== "conta" || !id) return;
    const atual = saldos.get(id);
    if (atual !== undefined) saldos.set(id, atual + delta);
  };

  for (const tx of txs) {
    if (tx.tipo === "receita") add("conta", tx.accountId, tx.valor);
    else if (tx.tipo === "despesa") add("conta", tx.accountId, -tx.valor);
    else {
      add(tx.origemTipo, tx.origemId, -tx.valor);
      add(tx.destinoTipo, tx.destinoId, tx.valor);
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
  instituicao: string | null;
  tipo: "debito" | "credito";
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
  contaFinanceiraId: string,
  ref: Date = new Date()
): Promise<FaturaCartao[]> {
  return faturasDoDia(contaFinanceiraId, dayKeySP(ref));
}

async function faturasDoDia(
  contaFinanceiraId: string,
  dia: string
): Promise<FaturaCartao[]> {
  "use cache";
  cacheTag(tagUsuario(contaFinanceiraId, "financas"));
  cacheLife("usuario");

  const refSP = toSP(refDoDiaSP(dia));
  const [cards, txs, transferenciasCartao] = await Promise.all([
    db.card.findMany({ where: { contaFinanceiraId } }),
    db.transaction.findMany({
      where: { contaFinanceiraId, cardId: { not: null }, tipo: "despesa" },
      select: { valor: true, data: true, cardId: true },
    }),
    db.transaction.findMany({
      where: {
        contaFinanceiraId,
        tipo: "transferencia",
        OR: [{ origemTipo: "cartao" }, { destinoTipo: "cartao" }],
      },
      select: { valor: true, data: true, origemTipo: true, origemId: true, destinoTipo: true, destinoId: true },
    }),
  ]);

  return cards.map((card) => {
    const limite = card.limite ?? 0;
    const diaHoje = getDate(refSP);
    const inicioCiclo =
      diaHoje > card.fechamento
        ? new Date(refSP.getFullYear(), refSP.getMonth(), card.fechamento + 1)
        : new Date(refSP.getFullYear(), refSP.getMonth() - 1, card.fechamento + 1);

    const doCartao = txs.filter((t) => t.cardId === card.id);
    // Dinheiro saindo do cartão (ex.: cartão → ativo) soma na fatura, como uma compra.
    const saidasDoCartao = transferenciasCartao.filter(
      (t) => t.origemTipo === "cartao" && t.origemId === card.id
    );
    // Dinheiro entrando para quitar (ex.: ativo → cartão) abate a fatura, como um pagamento.
    const pagamentosDeFatura = transferenciasCartao.filter(
      (t) => t.destinoTipo === "cartao" && t.destinoId === card.id
    );
    const somaDesde = (txs: { valor: number; data: Date }[], desde?: Date) =>
      txs
        .filter((t) => !desde || toSP(t.data) >= toSP(desde))
        .reduce((s, t) => s + t.valor, 0);

    const faturaAberta =
      somaDesde(doCartao, inicioCiclo) +
      somaDesde(saidasDoCartao, inicioCiclo) -
      somaDesde(pagamentosDeFatura, inicioCiclo);
    const utilizado =
      somaDesde(doCartao) + somaDesde(saidasDoCartao) - somaDesde(pagamentosDeFatura);

    return {
      id: card.id,
      nome: card.nome,
      bandeira: card.bandeira,
      instituicao: card.instituicao,
      tipo: card.tipo === "debito" ? "debito" : "credito",
      cor: card.cor,
      limite,
      fechamento: card.fechamento,
      vencimento: card.vencimento,
      faturaAberta,
      utilizado,
      pctLimite: limite > 0 ? (faturaAberta / limite) * 100 : 0,
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

/**
 * Receita × despesa dos últimos N meses (inclui o mês de referência).
 * Assinaturas ativas entram como despesa em todos os meses da janela.
 */
export async function fluxoDeCaixa(
  contaFinanceiraId: string,
  meses = 6,
  ref: Date = new Date()
): Promise<FluxoMes[]> {
  return fluxoDeCaixaDoMes(contaFinanceiraId, meses, monthKeySP(ref));
}

async function fluxoDeCaixaDoMes(
  contaFinanceiraId: string,
  meses: number,
  mes: string
): Promise<FluxoMes[]> {
  "use cache";
  cacheTag(tagUsuario(contaFinanceiraId, "financas"));
  cacheLife("usuario");

  const ref = refDoMesSP(mes);
  const inicio = spStartOfMonth(subMonths(toSP(ref), meses - 1));
  const fim = spEndOfMonth(ref);

  const [txs, assinaturas] = await Promise.all([
    db.transaction.findMany({
      where: {
        contaFinanceiraId,
        data: { gte: inicio, lte: fim },
        // espelha contaNosTotaisDeFluxo() (financas-calc.ts): compromisso
        // fica fora do fluxo de caixa, mesmo regra do resto do arquivo.
        OR: [{ tipo: "receita" }, { tipo: "despesa", natureza: "despesa" }],
      },
      select: { tipo: true, valor: true, data: true },
    }),
    assinaturasAtivas(contaFinanceiraId),
  ]);
  const totalAssinaturas = somaAssinaturas(assinaturas, 31);

  // uma passada: totais por mês, com a chave calculada 1x por transação
  const porMes = new Map<string, { receita: number; despesa: number }>();
  for (const tx of txs) {
    const chave = monthKeySP(toSP(tx.data));
    let acc = porMes.get(chave);
    if (!acc) porMes.set(chave, (acc = { receita: 0, despesa: 0 }));
    if (tx.tipo === "receita") acc.receita += tx.valor;
    else acc.despesa += tx.valor;
  }

  const out: FluxoMes[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const mesRef = subMonths(toSP(ref), i);
    const { receita, despesa } = porMes.get(monthKeySP(mesRef)) ?? {
      receita: 0,
      despesa: 0,
    };
    out.push({
      label: monthName(mesRef).slice(0, 3),
      receita,
      despesa: despesa + totalAssinaturas,
      saldo: receita - despesa - totalAssinaturas,
    });
  }
  return out;
}

// ---------- Gastos por dia (heatmap) ----------

export async function gastosPorDiaDoMes(
  contaFinanceiraId: string,
  ref: Date = new Date()
): Promise<{ dia: number; valor: number }[]> {
  return gastosDoMes(contaFinanceiraId, monthKeySP(ref));
}

async function gastosDoMes(
  contaFinanceiraId: string,
  mes: string
): Promise<{ dia: number; valor: number }[]> {
  "use cache";
  cacheTag(tagUsuario(contaFinanceiraId, "financas"));
  cacheLife("usuario");

  const ref = refDoMesSP(mes);
  const [txs, assinaturas] = await Promise.all([
    db.transaction.findMany({
      where: {
        contaFinanceiraId,
        tipo: "despesa",
        natureza: "despesa",
        data: { gte: spStartOfMonth(ref), lte: spEndOfMonth(ref) },
      },
      select: { valor: true, data: true },
    }),
    assinaturasAtivas(contaFinanceiraId),
  ]);

  const dias = getDaysInMonth(toSP(ref));
  const map = new Map<number, number>();
  for (const tx of txs) {
    const d = getDate(toSP(tx.data));
    map.set(d, (map.get(d) ?? 0) + tx.valor);
  }
  for (const a of assinaturas) {
    const d = Math.min(a.diaCobranca, dias);
    map.set(d, (map.get(d) ?? 0) + a.valor);
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
  contaFinanceiraId: string,
  dias = 7,
  ref: Date = new Date()
): Promise<Vencimento[]> {
  return vencimentosDoDia(contaFinanceiraId, dias, dayKeySP(ref));
}

async function vencimentosDoDia(
  contaFinanceiraId: string,
  dias: number,
  diaKey: string
): Promise<Vencimento[]> {
  "use cache";
  cacheTag(tagUsuario(contaFinanceiraId, "financas"));
  cacheLife("usuario");

  const ref = refDoDiaSP(diaKey);
  const de = spStartOfDay(ref);
  const ate = spEndOfDay(addDays(toSP(ref), dias));

  const [assinaturas, parcelas] = await Promise.all([
    db.subscription.findMany({ where: { contaFinanceiraId, status: "ativa" } }),
    db.transaction.findMany({
      where: {
        contaFinanceiraId,
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
  primeiraData: Date;
  accountId: string | null;
  categoryId: string | null;
  cardId: string | null;
  tags: string[];
  natureza: string;
};

export async function parcelamentos(
  contaFinanceiraId: string,
  ref: Date = new Date()
): Promise<Parcelamento[]> {
  return parcelamentosDoDia(contaFinanceiraId, dayKeySP(ref));
}

async function parcelamentosDoDia(
  contaFinanceiraId: string,
  dia: string
): Promise<Parcelamento[]> {
  "use cache";
  cacheTag(tagUsuario(contaFinanceiraId, "financas"));
  cacheLife("usuario");

  const txs = await db.transaction.findMany({
    where: { contaFinanceiraId, parcelaGrupo: { not: null } },
    orderBy: { data: "asc" },
  });

  const grupos = new Map<string, typeof txs>();
  for (const tx of txs) {
    const g = tx.parcelaGrupo!;
    const lista = grupos.get(g);
    if (lista) lista.push(tx);
    else grupos.set(g, [tx]);
  }

  const hoje = spEndOfDay(refDoDiaSP(dia));
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
        primeiraData: itens[0].data,
        accountId: itens[0].accountId,
        categoryId: itens[0].categoryId,
        cardId: itens[0].cardId,
        tags: parseJSON<string[]>(itens[0].tags, []),
        natureza: itens[0].natureza,
      };
    })
    .filter((p) => p.pagas < p.parcelas)
    .sort((a, b) => (a.proxima?.getTime() ?? 0) - (b.proxima?.getTime() ?? 0));
}
