import { subMonths, subQuarters, subWeeks } from "date-fns";
import { db } from "@/lib/db";
import {
  monthKeySP,
  quarterKeySP,
  refDaSemanaSP,
  refDoMesSP,
  refDoSemestreSP,
  refDoTrimestreSP,
  semesterKeySP,
  spEndOfMonth,
  spEndOfQuarter,
  spEndOfSemester,
  spEndOfWeek,
  spStartOfMonth,
  spStartOfQuarter,
  spStartOfSemester,
  spStartOfWeek,
  toSP,
  weekKeySP,
} from "@/lib/dates";
import {
  METRICAS,
  calcularMetrica,
  type MetaMetrica,
} from "@/lib/data/metas-quantitativas-constantes";
import { gerarInsights, type InsightView } from "@/lib/data/desafios-insights";
import { streakLC } from "@/lib/data/home";
import { parseJSON } from "@/lib/utils";
import {
  PERIODOS_DESAFIO,
  type DesafioOrigem,
  type DesafioPeriodo,
} from "@/lib/data/desafios-constantes";

/**
 * Desafios: grupos de crescimento colaborativos estilo Gymrats. Cada membro
 * cadastra e possui as PRÓPRIAS metas (grandes + pequenas vinculadas); o
 * desafio só dá visibilidade cruzada entre membros. Progresso é sempre
 * expresso em % — permite comparar metas de conteúdo diferente entre pessoas
 * (ex.: eu "treinos" vs. ele "km_corridos").
 */

export { PERIODOS_DESAFIO };
export type { DesafioOrigem, DesafioPeriodo };

/** Converte (periodo, chave) num range de datas estável — mesmo espírito de metas-quantitativas.ts. */
function rangeDoPeriodo(periodo: DesafioPeriodo, chave: string): { inicio: Date; fim: Date } {
  if (periodo === "semana") {
    const ref = refDaSemanaSP(chave);
    return { inicio: spStartOfWeek(ref), fim: spEndOfWeek(ref) };
  }
  if (periodo === "mes") {
    const ref = refDoMesSP(chave);
    return { inicio: spStartOfMonth(ref), fim: spEndOfMonth(ref) };
  }
  if (periodo === "trimestre") {
    const ref = refDoTrimestreSP(chave);
    return { inicio: spStartOfQuarter(ref), fim: spEndOfQuarter(ref) };
  }
  const ref = refDoSemestreSP(chave);
  return { inicio: spStartOfSemester(ref), fim: spEndOfSemester(ref) };
}

function chaveDoPeriodo(periodo: DesafioPeriodo, data: Date): string {
  if (periodo === "semana") return weekKeySP(data);
  if (periodo === "mes") return monthKeySP(data);
  if (periodo === "trimestre") return quarterKeySP(data);
  return semesterKeySP(data);
}

/** Desloca `agora` N períodos pra trás — usado pra montar a série histórica. */
function deslocarPeriodo(periodo: DesafioPeriodo, data: Date, n: number): Date {
  const sp = toSP(data);
  if (periodo === "semana") return subWeeks(sp, n);
  if (periodo === "mes") return subMonths(sp, n);
  if (periodo === "trimestre") return subQuarters(sp, n);
  return subMonths(sp, n * 6); // semestre = 6 meses
}

type MetaRow = {
  id: string;
  userId: string;
  titulo: string;
  origem: string;
  metrica: string | null;
  rotinaTemplateId: string | null;
  variavelId: string | null;
  alvo: number;
  periodo: string;
};

/**
 * Dados brutos de UM usuário já carregados em memória, cobrindo o range
 * completo necessário (agora + série histórica). Isso evita o N+1 que tornava
 * a tela de Desafios extremamente lenta em produção.
 */
type DadosBrutosUsuario = {
  workoutSessions: { data: Date }[];
  runs: { data: Date; km: number }[];
  dietLogs: { data: Date; refeicoesCumpridas: string }[];
  studySessions: { startedAt: Date; netSeconds: number }[];
  rotinaChecks: Map<string, { data: Date }[]>; // por rotinaTemplateId
  variavelChecks: Map<string, { data: Date }[]>; // por variavelId
  dinheiroLancamentos: { data: Date; valor: number }[];
};

function dentro(data: Date, inicio: Date, fim: Date): boolean {
  return data >= inicio && data <= fim;
}

/**
 * Carrega os dados brutos de TODOS os membros informados numa única leva de
 * 6 queries (com `userId: { in: [...] }`), em vez de 1 leva por membro —
 * o custo fica fixo em 6 round-trips independente do nº de membros do desafio.
 */
async function carregarDadosBrutosMultiUsuario(
  membros: {
    userId: string;
    inicio: Date;
    fim: Date;
    rotinaTemplateIds: string[];
    variavelIds: string[];
  }[]
): Promise<Map<string, DadosBrutosUsuario>> {
  const userIds = membros.map((m) => m.userId);
  const inicioTotal = new Date(Math.min(...membros.map((m) => m.inicio.getTime())));
  const fimTotal = new Date(Math.max(...membros.map((m) => m.fim.getTime())));
  const rotinaIdsUnicos = [...new Set(membros.flatMap((m) => m.rotinaTemplateIds))];
  const variavelIdsUnicos = [...new Set(membros.flatMap((m) => m.variavelIds))];

  const [
    workoutSessions,
    runs,
    dietLogs,
    studySessions,
    rotinaChecksFlat,
    variavelChecksFlat,
    dinheiroLancamentosFlat,
  ] = await Promise.all([
    db.workoutSession.findMany({
      where: { userId: { in: userIds }, data: { gte: inicioTotal, lte: fimTotal } },
      select: { userId: true, data: true },
    }),
    db.run.findMany({
      where: { userId: { in: userIds }, data: { gte: inicioTotal, lte: fimTotal } },
      select: { userId: true, data: true, km: true },
    }),
    db.dietDayLog.findMany({
      where: { userId: { in: userIds }, data: { gte: inicioTotal, lte: fimTotal } },
      select: { userId: true, data: true, refeicoesCumpridas: true },
    }),
    db.studySession.findMany({
      where: {
        userId: { in: userIds },
        startedAt: { gte: inicioTotal, lte: fimTotal },
        endedAt: { not: null },
      },
      select: { userId: true, startedAt: true, netSeconds: true },
    }),
    rotinaIdsUnicos.length > 0
      ? db.rotinaCheckDia.findMany({
          where: {
            userId: { in: userIds },
            rotinaId: { in: rotinaIdsUnicos },
            data: { gte: inicioTotal, lte: fimTotal },
          },
          select: { userId: true, rotinaId: true, data: true },
        })
      : Promise.resolve([]),
    variavelIdsUnicos.length > 0
      ? db.variavelCheckDia.findMany({
          where: {
            userId: { in: userIds },
            variavelId: { in: variavelIdsUnicos },
            data: { gte: inicioTotal, lte: fimTotal },
          },
          select: { userId: true, variavelId: true, data: true },
        })
      : Promise.resolve([]),
    db.dinheiroLancamento.findMany({
      where: { userId: { in: userIds }, data: { gte: inicioTotal, lte: fimTotal } },
      select: { userId: true, data: true, valor: true },
    }),
  ]);

  const porUsuario = new Map<string, DadosBrutosUsuario>();
  for (const m of membros) {
    porUsuario.set(m.userId, {
      workoutSessions: [],
      runs: [],
      dietLogs: [],
      studySessions: [],
      rotinaChecks: new Map(),
      variavelChecks: new Map(),
      dinheiroLancamentos: [],
    });
  }
  for (const s of workoutSessions) porUsuario.get(s.userId)?.workoutSessions.push({ data: s.data });
  for (const r of runs) porUsuario.get(r.userId)?.runs.push({ data: r.data, km: r.km });
  for (const l of dietLogs)
    porUsuario
      .get(l.userId)
      ?.dietLogs.push({ data: l.data, refeicoesCumpridas: l.refeicoesCumpridas });
  for (const s of studySessions)
    porUsuario
      .get(s.userId)
      ?.studySessions.push({ startedAt: s.startedAt, netSeconds: s.netSeconds });
  for (const c of rotinaChecksFlat) {
    const dados = porUsuario.get(c.userId);
    if (!dados) continue;
    const lista = dados.rotinaChecks.get(c.rotinaId) ?? [];
    lista.push({ data: c.data });
    dados.rotinaChecks.set(c.rotinaId, lista);
  }
  for (const c of variavelChecksFlat) {
    const dados = porUsuario.get(c.userId);
    if (!dados) continue;
    const lista = dados.variavelChecks.get(c.variavelId) ?? [];
    lista.push({ data: c.data });
    dados.variavelChecks.set(c.variavelId, lista);
  }
  for (const l of dinheiroLancamentosFlat)
    porUsuario.get(l.userId)?.dinheiroLancamentos.push({ data: l.data, valor: l.valor });

  return porUsuario;
}

/** Progresso (atual) de UMA meta folha num período específico, calculado em memória a partir de DadosBrutosUsuario. */
function calcularAtualMeta(meta: MetaRow, dados: DadosBrutosUsuario, inicio: Date, fim: Date): number {
  if (meta.origem === "metrica" && meta.metrica) {
    // As fórmulas moram em metas-quantitativas-constantes.ts (fonte única,
    // compartilhada com metas-quantitativas.ts): aqui só recortamos o período.
    return calcularMetrica(meta.metrica as MetaMetrica, {
      treinos: dados.workoutSessions.filter((s) => dentro(s.data, inicio, fim)).length,
      corridas: dados.runs.filter((r) => dentro(r.data, inicio, fim)).length,
      km: dados.runs
        .filter((r) => dentro(r.data, inicio, fim))
        .reduce((s, r) => s + r.km, 0),
      refeicoesCumpridas: dados.dietLogs
        .filter((l) => dentro(l.data, inicio, fim))
        .reduce((s, l) => s + parseJSON<string[]>(l.refeicoesCumpridas, []).length, 0),
      segundosEstudo: dados.studySessions
        .filter((s) => dentro(s.startedAt, inicio, fim))
        .reduce((s, x) => s + x.netSeconds, 0),
      dinheiroCentavos: dados.dinheiroLancamentos
        .filter((l) => dentro(l.data, inicio, fim))
        .reduce((s, l) => s + l.valor, 0),
    });
  }
  if (meta.origem === "checklist" && meta.rotinaTemplateId) {
    const checks = dados.rotinaChecks.get(meta.rotinaTemplateId) ?? [];
    return checks.filter((c) => dentro(c.data, inicio, fim)).length;
  }
  if (meta.origem === "variavel" && meta.variavelId) {
    const checks = dados.variavelChecks.get(meta.variavelId) ?? [];
    return checks.filter((c) => dentro(c.data, inicio, fim)).length;
  }
  return 0;
}

export type DesafioResumo = {
  id: string;
  nome: string;
  descricao: string | null;
  codigo: string;
  criadorId: string;
  metasGrandesLimite: number;
  totalMembros: number;
};

/** Desafios em que o usuário participa, com contagens básicas. */
export async function desafiosDoUsuario(userId: string): Promise<DesafioResumo[]> {
  const membrosDe = await db.desafioMembro.findMany({
    where: { userId },
    select: { desafioId: true },
  });
  const desafioIds = membrosDe.map((m) => m.desafioId);
  if (desafioIds.length === 0) return [];

  const desafios = await db.desafio.findMany({
    where: { id: { in: desafioIds }, ativo: true },
    orderBy: { criadoEm: "desc" },
    include: { _count: { select: { membros: true } } },
  });

  return desafios.map((d) => ({
    id: d.id,
    nome: d.nome,
    descricao: d.descricao,
    codigo: d.codigo,
    criadorId: d.criadorId,
    metasGrandesLimite: d.metasGrandesLimite,
    totalMembros: d._count.membros,
  }));
}

export type DesafioMetaView = {
  id: string;
  titulo: string;
  origem: DesafioOrigem;
  metrica: MetaMetrica | null;
  rotinaTemplateId: string | null;
  variavelId: string | null;
  unidade: string;
  atual: number;
  alvo: number;
  pct: number;
  periodo: DesafioPeriodo;
  ordem: number;
  serie: number[]; // % nos últimos pontos (mais antigo -> mais recente, último = atual)
  filhas: DesafioMetaView[];
};

export type MembroDesafio = {
  userId: string;
  nome: string | null;
  avatarUrl: string | null;
  streak: number;
  metasGrandes: DesafioMetaView[];
};

export type DesafioDetalhe = {
  id: string;
  nome: string;
  descricao: string | null;
  codigo: string;
  criadorId: string;
  metasGrandesLimite: number;
  membros: MembroDesafio[];
  insights: InsightView[];
};

const PONTOS_SERIE = 8;

function unidadeDaMeta(meta: MetaRow): string {
  if (meta.origem === "metrica" && meta.metrica) {
    return METRICAS.find((m) => m.value === meta.metrica)?.unidade ?? "";
  }
  if (meta.origem === "variavel") return "dias";
  return "checks";
}

type MetaRowComPai = MetaRow & { metaPaiId: string | null };

/** Range de datas que cobre "agora" + todos os PONTOS_SERIE pontos históricos de um período. */
function rangeTotalDoPeriodo(periodo: DesafioPeriodo, agora: Date): { inicio: Date; fim: Date } {
  const dataMaisAntiga = deslocarPeriodo(periodo, agora, PONTOS_SERIE - 1);
  const inicio = rangeDoPeriodo(periodo, chaveDoPeriodo(periodo, dataMaisAntiga)).inicio;
  const fim = rangeDoPeriodo(periodo, chaveDoPeriodo(periodo, agora)).fim;
  return { inicio, fim };
}

/**
 * View completa de uma meta (com filhas e série), calculada para "agora" — puramente
 * em memória a partir de `dados` (já carregados em batch). Metas pequenas não têm
 * filhas (só 2 níveis).
 */
function viewDeMeta(
  meta: MetaRowComPai,
  filhas: MetaRowComPai[],
  agora: Date,
  dados: DadosBrutosUsuario
): DesafioMetaView {
  const periodo = meta.periodo as DesafioPeriodo;

  const filhasView = filhas.map((f) => viewDeMeta(f, [], agora, dados));

  const unidade = unidadeDaMeta(meta);

  if (filhasView.length > 0) {
    const atual = filhasView.reduce((s, f) => s + f.atual, 0);
    const alvo = filhasView.reduce((s, f) => s + f.alvo, 0) || meta.alvo;
    const pct = alvo > 0 ? (atual / alvo) * 100 : 0;
    const serie = Array.from({ length: PONTOS_SERIE }, (_, i) => i).map((i) => {
      const pesos = filhasView.map((f) => f.serie[i] ?? 0);
      return pesos.length > 0 ? pesos.reduce((s, v) => s + v, 0) / pesos.length : 0;
    });
    return {
      id: meta.id,
      titulo: meta.titulo,
      origem: meta.origem as DesafioOrigem,
      metrica: meta.metrica as MetaMetrica | null,
      rotinaTemplateId: meta.rotinaTemplateId,
      variavelId: meta.variavelId,
      unidade,
      atual,
      alvo,
      pct,
      periodo,
      ordem: 0,
      serie,
      filhas: filhasView,
    };
  }

  const { inicio, fim } = rangeDoPeriodo(periodo, chaveDoPeriodo(periodo, agora));
  const atual = calcularAtualMeta(meta, dados, inicio, fim);
  const pct = meta.alvo > 0 ? (atual / meta.alvo) * 100 : 0;

  const serie = Array.from({ length: PONTOS_SERIE }, (_, i) => PONTOS_SERIE - 1 - i).map((n) => {
    const dataDeslocada = deslocarPeriodo(periodo, agora, n);
    const chave = chaveDoPeriodo(periodo, dataDeslocada);
    const { inicio: ini, fim: f } = rangeDoPeriodo(periodo, chave);
    const valor = calcularAtualMeta(meta, dados, ini, f);
    return meta.alvo > 0 ? (valor / meta.alvo) * 100 : 0;
  });

  return {
    id: meta.id,
    titulo: meta.titulo,
    origem: meta.origem as DesafioOrigem,
    metrica: meta.metrica as MetaMetrica | null,
    rotinaTemplateId: meta.rotinaTemplateId,
    variavelId: meta.variavelId,
    unidade,
    atual,
    alvo: meta.alvo,
    pct,
    periodo,
    ordem: 0,
    serie,
    filhas: [],
  };
}

/** Detalhe completo: metas grandes de CADA membro (com filhas + série) e feed de insights. */
export async function desafioDetalhe(
  desafioId: string,
  agora: Date = new Date()
): Promise<DesafioDetalhe | null> {
  const desafio = await db.desafio.findUnique({
    where: { id: desafioId },
    include: {
      membros: { orderBy: { entrouEm: "asc" } },
      metas: { orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }] },
    },
  });
  if (!desafio) return null;

  const perfis = await db.profile.findMany({
    where: { id: { in: desafio.membros.map((m) => m.userId) } },
    select: { id: true, nome: true, avatarUrl: true },
  });
  const perfilPorId = new Map(perfis.map((p) => [p.id, p]));

  const metasPorMembro = new Map<string, typeof desafio.metas>();
  for (const m of desafio.metas) {
    const lista = metasPorMembro.get(m.userId) ?? [];
    lista.push(m);
    metasPorMembro.set(m.userId, lista);
  }

  // Range total por membro = união do range necessário (agora + série histórica)
  // de cada período distinto usado pelas metas dele — calculado sem I/O.
  const rangesPorMembro = desafio.membros.map((dm) => {
    const minhasMetas = metasPorMembro.get(dm.userId) ?? [];
    const periodosUsados = [...new Set(minhasMetas.map((m) => m.periodo as DesafioPeriodo))];
    const ranges = periodosUsados.map((p) => rangeTotalDoPeriodo(p, agora));
    const inicio =
      ranges.length > 0 ? new Date(Math.min(...ranges.map((r) => r.inicio.getTime()))) : agora;
    const fim =
      ranges.length > 0 ? new Date(Math.max(...ranges.map((r) => r.fim.getTime()))) : agora;
    const rotinaTemplateIds = minhasMetas
      .filter((m) => m.origem === "checklist" && m.rotinaTemplateId)
      .map((m) => m.rotinaTemplateId as string);
    const variavelIds = minhasMetas
      .filter((m) => m.origem === "variavel" && m.variavelId)
      .map((m) => m.variavelId as string);
    return { userId: dm.userId, inicio, fim, rotinaTemplateIds, variavelIds };
  });

  // 1 única leva de 6 queries (com userId IN [...]) pra TODOS os membros do
  // desafio, em vez de 1 leva por membro — custo fixo independente do tamanho do grupo.
  const [dadosPorUsuario, streaksPorUsuario] = await Promise.all([
    carregarDadosBrutosMultiUsuario(rangesPorMembro),
    Promise.all(desafio.membros.map((dm) => streakLC(dm.userId, agora))),
  ]);
  const streakPorUsuario = new Map(
    desafio.membros.map((dm, i) => [dm.userId, streaksPorUsuario[i].streak])
  );

  const membros: MembroDesafio[] = desafio.membros.map((dm) => {
    const minhasMetas = metasPorMembro.get(dm.userId) ?? [];
    const dados = dadosPorUsuario.get(dm.userId)!;

    const grandes = minhasMetas
      .filter((m) => m.metaPaiId === null)
      .sort((a, b) => a.ordem - b.ordem);

    const metasGrandes = grandes.map((g, idx) => {
      const filhas = minhasMetas.filter((m) => m.metaPaiId === g.id);
      const view = viewDeMeta(g, filhas, agora, dados);
      return { ...view, ordem: idx };
    });

    return {
      userId: dm.userId,
      nome: perfilPorId.get(dm.userId)?.nome ?? null,
      avatarUrl: perfilPorId.get(dm.userId)?.avatarUrl ?? null,
      streak: streakPorUsuario.get(dm.userId) ?? 0,
      metasGrandes,
    };
  });

  const insights = gerarInsights(membros, agora);

  return {
    id: desafio.id,
    nome: desafio.nome,
    descricao: desafio.descricao,
    codigo: desafio.codigo,
    criadorId: desafio.criadorId,
    metasGrandesLimite: desafio.metasGrandesLimite,
    membros,
    insights,
  };
}
