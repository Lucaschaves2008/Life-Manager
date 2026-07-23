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
import { calcularAtual, METRICAS, type MetaMetrica } from "@/lib/data/metas-quantitativas";
import { gerarInsights, type InsightView } from "@/lib/data/desafios-insights";

/**
 * Desafios: grupos de crescimento colaborativos estilo Gymrats. Cada membro
 * cadastra e possui as PRÓPRIAS metas (grandes + pequenas vinculadas); o
 * desafio só dá visibilidade cruzada entre membros. Progresso é sempre
 * expresso em % — permite comparar metas de conteúdo diferente entre pessoas
 * (ex.: eu "treinos" vs. ele "km_corridos").
 */

export type DesafioPeriodo = "semana" | "mes" | "trimestre" | "semestre";
export type DesafioOrigem = "metrica" | "checklist";

export const PERIODOS_DESAFIO: { value: DesafioPeriodo; label: string }[] = [
  { value: "semana", label: "Semanal" },
  { value: "mes", label: "Mensal" },
  { value: "trimestre", label: "Trimestral" },
  { value: "semestre", label: "Semestral" },
];

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
  alvo: number;
  periodo: string;
};

/** Progresso bruto (atual/alvo) de UMA meta folha (sem filhas) num período específico. */
async function calcularAtualMeta(meta: MetaRow, inicio: Date, fim: Date): Promise<number> {
  if (meta.origem === "metrica" && meta.metrica) {
    return calcularAtual(meta.userId, meta.metrica as MetaMetrica, inicio, fim);
  }
  if (meta.origem === "checklist" && meta.rotinaTemplateId) {
    return db.rotinaCheckDia.count({
      where: { userId: meta.userId, rotinaId: meta.rotinaTemplateId, data: { gte: inicio, lte: fim } },
    });
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

async function unidadeDaMeta(meta: MetaRow): Promise<string> {
  if (meta.origem === "metrica" && meta.metrica) {
    return METRICAS.find((m) => m.value === meta.metrica)?.unidade ?? "";
  }
  return "checks";
}

type MetaRowComPai = MetaRow & { metaPaiId: string | null };

/** View completa de uma meta (com filhas e série), calculada para "agora". Metas pequenas não têm filhas (só 2 níveis). */
async function viewDeMeta(
  meta: MetaRowComPai,
  filhas: MetaRowComPai[],
  agora: Date
): Promise<DesafioMetaView> {
  const periodo = meta.periodo as DesafioPeriodo;

  const filhasView = await Promise.all(filhas.map((f) => viewDeMeta(f, [], agora)));

  const unidade = await unidadeDaMeta(meta);

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
  const atual = await calcularAtualMeta(meta, inicio, fim);
  const pct = meta.alvo > 0 ? (atual / meta.alvo) * 100 : 0;

  const serie = await Promise.all(
    Array.from({ length: PONTOS_SERIE }, (_, i) => PONTOS_SERIE - 1 - i).map(async (n) => {
      const dataDeslocada = deslocarPeriodo(periodo, agora, n);
      const chave = chaveDoPeriodo(periodo, dataDeslocada);
      const { inicio: ini, fim: f } = rangeDoPeriodo(periodo, chave);
      const valor = await calcularAtualMeta(meta, ini, f);
      return meta.alvo > 0 ? (valor / meta.alvo) * 100 : 0;
    })
  );

  return {
    id: meta.id,
    titulo: meta.titulo,
    origem: meta.origem as DesafioOrigem,
    metrica: meta.metrica as MetaMetrica | null,
    rotinaTemplateId: meta.rotinaTemplateId,
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

  const membros: MembroDesafio[] = await Promise.all(
    desafio.membros.map(async (dm) => {
      const minhasMetas = metasPorMembro.get(dm.userId) ?? [];
      const grandes = minhasMetas
        .filter((m) => m.metaPaiId === null)
        .sort((a, b) => a.ordem - b.ordem);

      const metasGrandes = await Promise.all(
        grandes.map(async (g, idx) => {
          const filhas = minhasMetas.filter((m) => m.metaPaiId === g.id);
          const view = await viewDeMeta(g, filhas, agora);
          return { ...view, ordem: idx };
        })
      );

      return {
        userId: dm.userId,
        nome: perfilPorId.get(dm.userId)?.nome ?? null,
        avatarUrl: perfilPorId.get(dm.userId)?.avatarUrl ?? null,
        metasGrandes,
      };
    })
  );

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
