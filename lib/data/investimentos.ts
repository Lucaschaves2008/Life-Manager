import { eachMonthOfInterval, subMonths, subYears } from "date-fns";
import { db } from "@/lib/db";
import { monthName, spEndOfMonth, spStartOfMonth, toSP } from "@/lib/dates";

export type Movimento = {
  id: string;
  tipo: string;
  valor: number;
  data: Date;
  nota: string | null;
};

/**
 * Valor de um ativo numa data: caminha os movimentos em ordem cronológica.
 * aporte soma, resgate subtrai, atualizacao DEFINE o valor total.
 */
export function valorEm(movs: Movimento[], ate: Date): number {
  let valor = 0;
  for (const m of movs) {
    if (m.data > ate) break;
    if (m.tipo === "aporte") valor += m.valor;
    else if (m.tipo === "resgate") valor -= m.valor;
    else valor = m.valor;
  }
  return Math.max(0, valor);
}

/** Aportes − resgates até a data (dinheiro do próprio bolso). */
export function aportadoEm(movs: Movimento[], ate: Date): number {
  let total = 0;
  for (const m of movs) {
    if (m.data > ate) break;
    if (m.tipo === "aporte") total += m.valor;
    else if (m.tipo === "resgate") total -= m.valor;
  }
  return total;
}

export type AtivoResumo = {
  id: string;
  nome: string;
  classe: string;
  instituicao: string;
  cor: string;
  valorAtual: number;
  aportado: number;
  rendimento: number;
  pctRendimento: number | null;
  /** série mensal dos últimos 6 meses para o sparkline */
  serie: number[];
  movimentos: Movimento[];
};

export async function ativosResumidos(ref: Date = new Date()): Promise<AtivoResumo[]> {
  const ativos = await db.asset.findMany({
    include: { movements: { orderBy: { data: "asc" } } },
    orderBy: { criadoEm: "asc" },
  });

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
      const rendimento = valorAtual - aportado;
      return {
        id: ativo.id,
        nome: ativo.nome,
        classe: ativo.classe,
        instituicao: ativo.instituicao,
        cor: ativo.cor,
        valorAtual,
        aportado,
        rendimento,
        pctRendimento: aportado > 0 ? (rendimento / aportado) * 100 : null,
        serie: meses.map((m) => valorEm(movs, spEndOfMonth(m))),
        movimentos: movs,
      };
    })
    .sort((a, b) => b.valorAtual - a.valorAtual);
}

export type PontoPatrimonio = { label: string; valor: number; marcado?: boolean };

/** Evolução do patrimônio total mês a mês. */
export async function evolucaoPatrimonio(
  meses = 6,
  ref: Date = new Date()
): Promise<PontoPatrimonio[]> {
  const ativos = await db.asset.findMany({
    include: { movements: { orderBy: { data: "asc" } } },
  });

  const todos: Movimento[][] = ativos.map((a) =>
    a.movements.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      valor: m.valor,
      data: m.data,
      nota: m.nota,
    }))
  );

  const intervalo = eachMonthOfInterval({
    start: spStartOfMonth(subMonths(toSP(ref), meses - 1)),
    end: spStartOfMonth(ref),
  });

  return intervalo.map((mes) => {
    const fim = spEndOfMonth(mes);
    const valor = todos.reduce((s, movs) => s + valorEm(movs, fim), 0);
    const teveAporte = todos.some((movs) =>
      movs.some(
        (m) => m.tipo === "aporte" && m.data >= spStartOfMonth(mes) && m.data <= fim
      )
    );
    return { label: monthName(mes).slice(0, 3), valor, marcado: teveAporte };
  });
}

export type ResumoCarteira = {
  patrimonio: number;
  aportado: number;
  rendimento: number;
  pctRendimento: number | null;
  /** rendimento do mês: variação de valor que não veio de aporte/resgate */
  rendimentoMes: number;
  pctRendimentoMes: number | null;
  porClasse: { classe: string; valor: number; cor: string }[];
};

export async function resumoCarteira(ref: Date = new Date()): Promise<ResumoCarteira> {
  const ativos = await ativosResumidos(ref);
  const patrimonio = ativos.reduce((s, a) => s + a.valorAtual, 0);
  const aportado = ativos.reduce((s, a) => s + a.aportado, 0);

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
