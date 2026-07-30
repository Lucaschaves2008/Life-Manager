import {
  cacheLife,
  cacheTag,
} from "next/cache";
import { eachDayOfInterval, subDays } from "date-fns";
import { db } from "@/lib/db";
import { tagUsuario } from "@/lib/cache-tags";
import { dayKeySP, refDoDiaSP, shortDate, spEndOfDay, spStartOfDay } from "@/lib/dates";
import { expandEvent } from "@/lib/recurrence";
import { templateParaEventLike, type RotinaEventLike, type RotinaTemplateRow } from "@/lib/rotina-helpers";

// Padrão de cache deste arquivo (ver estudos.ts): wrapper mantém a assinatura
// com Date de request e delega para uma interna "use cache" com chave estável
// (userId/dayKey). O TEMPO EXECUTADO por item de estudo é derivado das sessões
// do dia daquela categoria — some no wrapper, fora do cache, porque a sessão em
// andamento conta segundos "até agora". A tag "checklist" cobre RotinaTemplate/
// RotinaCheckDia; a tag "estudos" cobre as sessões — o wrapper lê as duas fontes.
// A expansão de recorrência reusa expandEvent (lib/recurrence.ts), o mesmo
// motor da Agenda: cada RotinaTemplate vira um EventLike sintético, e
// expandEvent devolve 0 ou 1 ocorrência para a janela de um dia.

export const TIPOS_ROTINA = ["livre", "estudo", "treino", "corrida"] as const;
export type TipoRotina = (typeof TIPOS_ROTINA)[number];

export type RotinaOcorrenciaView = {
  templateId: string;
  nome: string;
  horaInicio: string | null;
  horaFim: string | null;
  ordem: number;
  tipo: TipoRotina;
  studyCategoryId: string | null;
  routineId: string | null;
  runSessionId: string | null;
  metaMinutos: number | null;
  planoId: string | null;
  feito: boolean;
  feitoAuto: boolean;
  /** Segundos líquidos executados hoje na categoria vinculada (só tipo estudo). */
  executadoSec: number;
};

type RotinaTemplateDb = RotinaTemplateRow & {
  ordem: number;
  tipo: string;
  studyCategoryId: string | null;
  routineId: string | null;
  runSessionId: string | null;
  metaMinutos: number | null;
  planoId: string | null;
};

/**
 * Ocorrências do dia (checklist unificado), já com o tempo executado (para as
 * de estudo) derivado das sessões daquela categoria no mesmo dia. Ordenadas
 * por horaInicio (itens sem hora ao final), depois por `ordem`.
 */
export async function rotinasDoDia(userId: string, dia: Date): Promise<RotinaOcorrenciaView[]> {
  const dayKey = dayKeySP(dia);
  const [templatesTodas, checks, planoAtivoId] = await Promise.all([
    templatesAtivos(userId),
    checksDoDia(userId, dayKey),
    planoAtivoNoDia(userId, dayKey),
  ]);
  // "comum" (planoId=null) aparece sempre; os demais só se forem do plano ativo do dia
  const templates = templatesTodas.filter((t) => t.planoId === null || t.planoId === planoAtivoId);

  const ref = refDoDiaSP(dayKey);
  const from = spStartOfDay(ref);
  const to = spEndOfDay(ref);

  const ocorrencias = templates
    .flatMap((t) => expandEvent(templateParaEventLike(t), from, to))
    .map((oc) => {
      const ev = oc.event as RotinaEventLike & RotinaTemplateDb;
      return {
        templateId: ev.id,
        nome: ev.titulo,
        horaInicio: ev.horaInicio,
        horaFim: ev.horaFim,
        ordem: ev.ordem,
        tipo: ev.tipo as TipoRotina,
        studyCategoryId: ev.studyCategoryId,
        routineId: ev.routineId,
        runSessionId: ev.runSessionId,
        metaMinutos: ev.metaMinutos,
        planoId: ev.planoId,
        feito: checks.has(ev.id),
        feitoAuto: checks.get(ev.id) ?? false,
        executadoSec: 0,
      };
    })
    .sort((a, b) => {
      if (a.horaInicio && b.horaInicio) return a.horaInicio.localeCompare(b.horaInicio) || a.ordem - b.ordem;
      if (a.horaInicio) return -1;
      if (b.horaInicio) return 1;
      return a.ordem - b.ordem;
    });

  const temEstudo = ocorrencias.some((o) => o.tipo === "estudo" && o.studyCategoryId);
  const segPorCategoria = temEstudo
    ? await segundosPorCategoriaNoDia(userId, dia)
    : new Map<string, number>();

  return ocorrencias.map((o) => ({
    ...o,
    executadoSec:
      o.tipo === "estudo" && o.studyCategoryId ? segPorCategoria.get(o.studyCategoryId) ?? 0 : 0,
  }));
}

export type DiaResumoRotina = { key: string; label: string; pct: number };

/**
 * % de itens da Minha Rotina concluídos por dia, últimos N dias (para o
 * resumo semanal do checklist). Expande a recorrência de cada template
 * ativo contra cada dia da janela — mesma lógica de `rotinasDoDia`, mas em
 * lote para os N dias em vez de um único dia.
 */
export async function resumoSemanalRotina(
  userId: string,
  dias: number,
  ref: Date
): Promise<DiaResumoRotina[]> {
  return resumoSemanalRotinaDoDia(userId, dias, dayKeySP(ref));
}

async function resumoSemanalRotinaDoDia(
  userId: string,
  dias: number,
  dia: string
): Promise<DiaResumoRotina[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "checklist"));
  cacheLife("days");

  const ref = refDoDiaSP(dia);
  const de = spStartOfDay(subDays(ref, dias - 1));
  const ate = spEndOfDay(ref);

  const [templates, checks] = await Promise.all([
    templatesAtivos(userId),
    db.rotinaCheckDia.findMany({
      where: { userId, data: { gte: de, lte: ate } },
      select: { rotinaId: true, data: true },
    }),
  ]);

  const checksPorDia = new Map<string, Set<string>>();
  for (const c of checks) {
    const key = dayKeySP(c.data);
    const set = checksPorDia.get(key) ?? new Set<string>();
    set.add(c.rotinaId);
    checksPorDia.set(key, set);
  }

  const ocorrenciasPorDia = new Map<string, string[]>();
  for (const t of templates) {
    const ocorrencias = expandEvent(templateParaEventLike(t), de, ate);
    for (const oc of ocorrencias) {
      const key = oc.dayKey;
      const lista = ocorrenciasPorDia.get(key) ?? [];
      lista.push(t.id);
      ocorrenciasPorDia.set(key, lista);
    }
  }

  return eachDayOfInterval({ start: de, end: ate }).map((d) => {
    const key = dayKeySP(d);
    const ids = ocorrenciasPorDia.get(key) ?? [];
    const feitos = checksPorDia.get(key) ?? new Set<string>();
    const totalFeitos = ids.filter((id) => feitos.has(id)).length;
    return {
      key,
      label: shortDate(d),
      pct: ids.length > 0 ? (totalFeitos / ids.length) * 100 : 0,
    };
  });
}

async function templatesAtivos(userId: string): Promise<RotinaTemplateDb[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "checklist"));
  cacheLife("days");
  const templates = await db.rotinaTemplate.findMany({
    where: { userId, ativo: true },
    orderBy: { ordem: "asc" },
  });
  return templates as RotinaTemplateDb[];
}

/** Id do plano vigente no dia: escolha explícita (RotinaDiaPlano), senão o padrão do usuário. */
async function planoAtivoNoDia(userId: string, dayKey: string): Promise<string | null> {
  "use cache";
  cacheTag(tagUsuario(userId, "checklist"));
  cacheLife("days");
  const ref = refDoDiaSP(dayKey);
  const [escolha, padrao] = await Promise.all([
    db.rotinaDiaPlano.findFirst({
      where: { userId, data: spStartOfDay(ref) },
      select: { planoId: true },
    }),
    db.rotinaPlano.findFirst({
      where: { userId, ativo: true, padrao: true },
      select: { id: true },
    }),
  ]);
  return escolha?.planoId ?? padrao?.id ?? null;
}

/** Map templateId → feitoAuto, para as ocorrências marcadas no dia. */
async function checksDoDia(userId: string, dayKey: string): Promise<Map<string, boolean>> {
  "use cache";
  cacheTag(tagUsuario(userId, "checklist"));
  cacheLife("days");
  const ref = refDoDiaSP(dayKey);
  const checks = await db.rotinaCheckDia.findMany({
    where: { userId, data: { gte: spStartOfDay(ref), lte: spEndOfDay(ref) } },
    select: { rotinaId: true, feitoAuto: true },
  });
  return new Map(checks.map((c) => [c.rotinaId, c.feitoAuto]));
}

/**
 * Mapa categoriaId → segundos líquidos estudados no dia. Não é cacheado: usa
 * snapshotSessao para contar a sessão em andamento "até agora". A action do
 * cronômetro revalida "estudos", mas este cálculo depende do instante do
 * request, então roda sempre fresco.
 */
async function segundosPorCategoriaNoDia(
  userId: string,
  dia: Date
): Promise<Map<string, number>> {
  const ref = new Date(dia);
  const sessoes = await db.studySession.findMany({
    where: {
      userId,
      categoryId: { not: null },
      startedAt: { gte: spStartOfDay(ref), lte: spEndOfDay(ref) },
    },
    include: { pauses: true },
  });

  const agora = new Date();
  const mapa = new Map<string, number>();
  for (const s of sessoes) {
    if (!s.categoryId) continue;
    const liquido = liquidoSec(s, agora);
    mapa.set(s.categoryId, (mapa.get(s.categoryId) ?? 0) + liquido);
  }
  return mapa;
}

/** Segundos líquidos de uma sessão (finalizada usa gravado; aberta conta até agora). */
function liquidoSec(
  s: {
    startedAt: Date;
    endedAt: Date | null;
    netSeconds: number;
    pauses: { startedAt: Date; endedAt: Date | null; durationSec: number }[];
  },
  agora: Date
): number {
  if (s.endedAt) return s.netSeconds;
  const bruto = Math.max(0, Math.round((agora.getTime() - s.startedAt.getTime()) / 1000));
  const pausado = s.pauses.reduce((t, p) => {
    if (p.endedAt) return t + (p.durationSec || diffSec(p.startedAt, p.endedAt));
    return t + diffSec(p.startedAt, agora);
  }, 0);
  return Math.max(0, bruto - pausado);
}

function diffSec(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 1000));
}

// ---------- Opções de vínculo (para os seletores do formulário) ----------

export type RotinaOpcao = { id: string; nome: string; foco: string | null };

/** Rotinas de treino do usuário, para vincular a um item tipo "treino". */
export async function rotinasParaPlano(userId: string): Promise<RotinaOpcao[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "treinos"));
  cacheLife("days");
  const rotinas = await db.routine.findMany({
    where: { userId },
    orderBy: { ordem: "asc" },
    select: { id: true, nome: true, foco: true },
  });
  return rotinas;
}

// ---------- Gerenciamento (Sheet de criar/editar templates) ----------

export type RotinaTemplateView = {
  id: string;
  nome: string;
  horaInicio: string | null;
  horaFim: string | null;
  rrule: string | null;
  exdates: string[];
  ordem: number;
  tipo: TipoRotina;
  studyCategoryId: string | null;
  routineId: string | null;
  runSessionId: string | null;
  metaMinutos: number | null;
  planoId: string | null;
};

/** Todos os templates ativos do usuário, para a lista de gerenciamento. */
export async function rotinaTemplates(userId: string): Promise<RotinaTemplateView[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "checklist"));
  cacheLife("days");
  const templates = await db.rotinaTemplate.findMany({
    where: { userId, ativo: true },
    orderBy: { ordem: "asc" },
  });
  return templates.map((t) => ({
    id: t.id,
    nome: t.nome,
    horaInicio: t.horaInicio,
    horaFim: t.horaFim,
    rrule: t.rrule,
    exdates: safeArray(t.exdates),
    ordem: t.ordem,
    tipo: t.tipo as TipoRotina,
    studyCategoryId: t.studyCategoryId,
    routineId: t.routineId,
    runSessionId: t.runSessionId,
    metaMinutos: t.metaMinutos,
    planoId: t.planoId,
  }));
}

// ---------- Planos alternativos (Plano A / Plano B / ...) ----------

export type RotinaPlanoView = { id: string; nome: string; padrao: boolean; ordem: number };

/** Todos os planos ativos do usuário, ordenados (padrão sempre existe se houver ao menos 1). */
export async function rotinaPlanos(userId: string): Promise<RotinaPlanoView[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "checklist"));
  cacheLife("days");
  const planos = await db.rotinaPlano.findMany({
    where: { userId, ativo: true },
    orderBy: { ordem: "asc" },
    select: { id: true, nome: true, padrao: true, ordem: true },
  });
  return planos;
}

/** Id do plano vigente no dia (escolha explícita ou padrão), para a UI destacar o ativo. */
export async function rotinaPlanoDoDia(userId: string, dia: Date): Promise<string | null> {
  return planoAtivoNoDia(userId, dayKeySP(dia));
}

function safeArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
