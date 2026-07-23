import { cache } from "react";
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
} from "next/cache";
import { eachMonthOfInterval, getDaysInMonth, subMonths, subYears } from "date-fns";
import { db } from "@/lib/db";
import { tagUsuario } from "@/lib/cache-tags";
import {
  dayKeySP,
  monthName,
  refDoDiaSP,
  spEndOfDay,
  spEndOfMonth,
  spStartOfMonth,
  toSP,
} from "@/lib/dates";

// Padrão de cache: a função exportada mantém a assinatura original (userId,
// ref?) e delega para uma interna "use cache" com chaves ESTÁVEIS (userId +
// dayKey) — nunca um Date de request. Movimentos são gravados às 12:00 SP,
// então o corte diário usa o FIM do dia.

/** Carga única de ativos+movimentos, deduplicada por request via React cache. */
const carregarCarteira = cache(async (userId: string) => carteiraCacheada(userId));

// interna cacheada entre requests; o cache() acima dedupe dentro da request
async function carteiraCacheada(userId: string) {
  "use cache";
  cacheTag(tagUsuario(userId, "investimentos"));
  cacheLife("days");
  return db.asset.findMany({
    where: { userId },
    include: { movements: { orderBy: { data: "asc" } } },
    orderBy: { criadoEm: "asc" },
  });
}

export type Movimento = {
  id: string;
  tipo: string;
  valor: number;
  data: Date;
  nota: string | null;
};

/**
 * Valor de um ativo numa data: caminha os movimentos em ordem cronológica.
 * aporte e dividendo somam, resgate subtrai, atualizacao DEFINE o valor total.
 */
export function valorEm(movs: Movimento[], ate: Date): number {
  let valor = 0;
  for (const m of movs) {
    if (m.data > ate) break;
    if (m.tipo === "aporte" || m.tipo === "dividendo") valor += m.valor;
    else if (m.tipo === "resgate") valor -= m.valor;
    else if (m.tipo === "atualizacao") valor = m.valor;
  }
  return Math.max(0, valor);
}

/**
 * Aportes − resgates até a data (dinheiro do próprio bolso).
 * Dividendos NÃO entram: são rendimento, não capital investido.
 */
export function aportadoEm(movs: Movimento[], ate: Date): number {
  let total = 0;
  for (const m of movs) {
    if (m.data > ate) break;
    if (m.tipo === "aporte") total += m.valor;
    else if (m.tipo === "resgate") total -= m.valor;
  }
  return total;
}

/** Soma dos dividendos recebidos até a data. */
export function dividendosEm(movs: Movimento[], ate: Date): number {
  let total = 0;
  for (const m of movs) {
    if (m.data > ate) break;
    if (m.tipo === "dividendo") total += m.valor;
  }
  return total;
}

export type AtivoResumo = {
  id: string;
  nome: string;
  classe: string;
  instituicao: string;
  cor: string;
  diaAporte: number | null;
  revisarACada: number | null;
  valorAtual: number;
  aportado: number;
  dividendos: number;
  rendimento: number;
  pctRendimento: number | null;
  /** série mensal dos últimos 6 meses para o sparkline */
  serie: number[];
  movimentos: Movimento[];
};

export async function ativosResumidos(
  userId: string,
  ref: Date = new Date()
): Promise<AtivoResumo[]> {
  return ativosResumidosDoDia(userId, dayKeySP(ref));
}

async function ativosResumidosDoDia(
  userId: string,
  dia: string
): Promise<AtivoResumo[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "investimentos"));
  cacheLife("days");

  // fim do dia: inclui os movimentos datados de hoje (gravados às 12:00 SP)
  const ref = spEndOfDay(refDoDiaSP(dia));
  const ativos = await carregarCarteira(userId);

  const meses = eachMonthOfInterval({
    start: spStartOfMonth(subMonths(toSP(ref), 5)),
    end: spStartOfMonth(ref),
  });

  return ativos
    .map((ativo) => {
      const movs: Movimento[] = ativo.movements.map((m) => ({
        id: m.id,
        tipo: m.tipo,
        valor: m.valor,
        data: m.data,
        nota: m.nota,
      }));
      const valorAtual = valorEm(movs, ref);
      const aportado = aportadoEm(movs, ref);
      const dividendos = dividendosEm(movs, ref);
      const rendimento = valorAtual - aportado;
      return {
        id: ativo.id,
        nome: ativo.nome,
        classe: ativo.classe,
        instituicao: ativo.instituicao,
        cor: ativo.cor,
        diaAporte: ativo.diaAporte,
        revisarACada: ativo.revisarACada,
        valorAtual,
        aportado,
        dividendos,
        rendimento,
        pctRendimento: aportado > 0 ? (rendimento / aportado) * 100 : null,
        serie: meses.map((m) => valorEm(movs, spEndOfMonth(m))),
        movimentos: movs,
      };
    })
    .sort((a, b) => b.valorAtual - a.valorAtual);
}

export type PontoPatrimonio = {
  label: string;
  /** valor atual da carteira (o que você tem hoje) */
  valor: number;
  /** total aportado do próprio bolso até o mês (o que você guardou) */
  aportado: number;
  /** dividendos acumulados até o mês */
  dividendos: number;
  marcado?: boolean;
};

/** Evolução do patrimônio total mês a mês, com linhas de valor, aportado e dividendos. */
export async function evolucaoPatrimonio(
  userId: string,
  meses = 6,
  ref: Date = new Date()
): Promise<PontoPatrimonio[]> {
  return evolucaoPatrimonioDoDia(userId, meses, dayKeySP(ref));
}

async function evolucaoPatrimonioDoDia(
  userId: string,
  meses: number,
  dia: string
): Promise<PontoPatrimonio[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "investimentos"));
  cacheLife("days");

  const ref = refDoDiaSP(dia);
  const ativos = await carregarCarteira(userId);

  const intervalo = eachMonthOfInterval({
    start: spStartOfMonth(subMonths(toSP(ref), meses - 1)),
    end: spStartOfMonth(ref),
  });

  const pontos = intervalo.map((mes) => ({
    mes,
    inicio: spStartOfMonth(mes),
    fim: spEndOfMonth(mes),
    valor: 0,
    aportado: 0,
    dividendos: 0,
    marcado: false,
  }));

  // uma passada por movimento: acumula o estado do ativo e tira um snapshot por mês
  for (const ativo of ativos) {
    const movs = ativo.movements;
    let i = 0;
    let valor = 0;
    let aportado = 0;
    let dividendos = 0;
    for (const p of pontos) {
      while (i < movs.length && movs[i].data <= p.fim) {
        const m = movs[i];
        if (m.tipo === "aporte") {
          valor += m.valor;
          aportado += m.valor;
          if (m.data >= p.inicio) p.marcado = true;
        } else if (m.tipo === "dividendo") {
          valor += m.valor;
          dividendos += m.valor;
        } else if (m.tipo === "resgate") {
          valor -= m.valor;
          aportado -= m.valor;
        } else if (m.tipo === "atualizacao") {
          valor = m.valor;
        }
        i++;
      }
      p.valor += Math.max(0, valor);
      p.aportado += aportado;
      p.dividendos += dividendos;
    }
  }

  return pontos.map((p) => ({
    label: monthName(p.mes).slice(0, 3),
    valor: p.valor,
    aportado: p.aportado,
    dividendos: p.dividendos,
    marcado: p.marcado,
  }));
}

export type GrupoInstituicao = {
  instituicao: string;
  valorTotal: number;
  aportadoTotal: number;
  ativos: AtivoResumo[];
};

/** Agrupa os ativos por instituição (Inter, XP, etc.) para a visão por corretora. */
export async function porInstituicao(
  userId: string,
  ref: Date = new Date()
): Promise<GrupoInstituicao[]> {
  const ativos = await ativosResumidos(userId, ref);
  const grupos = new Map<string, AtivoResumo[]>();
  for (const a of ativos) {
    grupos.set(a.instituicao, [...(grupos.get(a.instituicao) ?? []), a]);
  }
  return Array.from(grupos.entries())
    .map(([instituicao, lista]) => ({
      instituicao,
      valorTotal: lista.reduce((s, a) => s + a.valorAtual, 0),
      aportadoTotal: lista.reduce((s, a) => s + a.aportado, 0),
      ativos: lista,
    }))
    .sort((a, b) => b.valorTotal - a.valorTotal);
}

export type AporteDevido = {
  id: string;
  nome: string;
  instituicao: string;
  cor: string;
  diaAporte: number;
};

/** Ativos com diaAporte configurado que cai nos próximos N dias (lembrete de aporte). */
export async function aportesDevidos(
  userId: string,
  dias = 7,
  ref: Date = new Date()
): Promise<AporteDevido[]> {
  return aportesDevidosDoDia(userId, dias, dayKeySP(ref));
}

async function aportesDevidosDoDia(
  userId: string,
  dias: number,
  dia: string
): Promise<AporteDevido[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "investimentos"));
  cacheLife("days");

  const hoje = toSP(refDoDiaSP(dia));
  const diaHoje = hoje.getDate();
  const ativos = (await carregarCarteira(userId))
    .filter((a) => a.diaAporte !== null)
    .sort((a, b) => a.diaAporte! - b.diaAporte!);

  return ativos
    .filter((a) => {
      const dia = a.diaAporte!;
      // dentro da janela [hoje, hoje+dias] considerando a virada de mês
      const diff = dia - diaHoje;
      return diff >= 0 ? diff <= dias : dia + getDaysInMonth(hoje) - diaHoje <= dias;
    })
    .map((a) => ({
      id: a.id,
      nome: a.nome,
      instituicao: a.instituicao,
      cor: a.cor,
      diaAporte: a.diaAporte!,
    }));
}

export type ResumoCarteira = {
  patrimonio: number;
  aportado: number;
  dividendos: number;
  rendimento: number;
  pctRendimento: number | null;
  /** rendimento do mês: variação de valor que não veio de aporte/resgate */
  rendimentoMes: number;
  pctRendimentoMes: number | null;
  porClasse: { classe: string; valor: number; cor: string }[];
};

export async function resumoCarteira(
  userId: string,
  ref: Date = new Date()
): Promise<ResumoCarteira> {
  return resumoCarteiraDoDia(userId, dayKeySP(ref));
}

async function resumoCarteiraDoDia(
  userId: string,
  dia: string
): Promise<ResumoCarteira> {
  "use cache";
  cacheTag(tagUsuario(userId, "investimentos"));
  cacheLife("days");

  // mesmo corte fim-do-dia dos ativos para manter os números consistentes
  const ref = spEndOfDay(refDoDiaSP(dia));
  const ativos = await ativosResumidosDoDia(userId, dia);
  const patrimonio = ativos.reduce((s, a) => s + a.valorAtual, 0);
  const aportado = ativos.reduce((s, a) => s + a.aportado, 0);
  const dividendos = ativos.reduce((s, a) => s + a.dividendos, 0);

  const inicioMes = spStartOfMonth(ref);
  let valorInicioMes = 0;
  let fluxoDoMes = 0;
  for (const ativo of ativos) {
    valorInicioMes += valorEm(ativo.movimentos, inicioMes);
    for (const m of ativo.movimentos) {
      if (m.data < inicioMes || m.data > ref) continue;
      if (m.tipo === "aporte") fluxoDoMes += m.valor;
      else if (m.tipo === "resgate") fluxoDoMes -= m.valor;
    }
  }
  const rendimentoMes = patrimonio - valorInicioMes - fluxoDoMes;

  const classes = new Map<string, { valor: number; cor: string }>();
  for (const a of ativos) {
    const atual = classes.get(a.classe);
    classes.set(a.classe, {
      valor: (atual?.valor ?? 0) + a.valorAtual,
      cor: atual?.cor ?? a.cor,
    });
  }

  return {
    patrimonio,
    aportado,
    dividendos,
    rendimento: patrimonio - aportado,
    pctRendimento: aportado > 0 ? ((patrimonio - aportado) / aportado) * 100 : null,
    rendimentoMes,
    pctRendimentoMes:
      valorInicioMes > 0 ? (rendimentoMes / valorInicioMes) * 100 : null,
    porClasse: Array.from(classes.entries())
      .map(([classe, v]) => ({ classe, valor: v.valor, cor: v.cor }))
      .sort((a, b) => b.valor - a.valor),
  };
}

/** Série anual (12 meses) para o seletor Ano. */
export function inicioDoAno(ref: Date = new Date()): Date {
  return spStartOfMonth(subYears(toSP(ref), 1));
}
