import {
  cacheLife,
  cacheTag,
} from "next/cache";
import { addDays, eachDayOfInterval, subDays } from "date-fns";
import { db } from "@/lib/db";
import { tagUsuario } from "@/lib/cache-tags";
import { dayKeySP, fmtSP, refDoDiaSP, shortDate, spEndOfDay, spStartOfDay } from "@/lib/dates";
import { expandEvent } from "@/lib/recurrence";
import { templateParaEventLike, type RotinaTemplateRow } from "@/lib/rotina-helpers";

// Padrão de cache deste arquivo (ver estudos.ts): wrapper mantém a assinatura
// com Date de request e delega para uma interna "use cache" com chave estável
// (userId/dayKey). O TEMPO EXECUTADO por item de estudo é derivado das sessões
// do dia daquela categoria — some no wrapper, fora do cache, porque a sessão em
// andamento conta segundos "até agora". A tag "checklist" cobre RotinaTemplate/
// RotinaCheckDia; a tag "estudos" cobre as sessões — o wrapper lê as duas fontes.
// A expansão de recorrência reusa expandEvent (lib/recurrence.ts), o mesmo
// motor da Agenda: cada RotinaTemplate vira um EventLike sintético, e
// expandEvent devolve 0 ou 1 ocorrência para a janela de um dia.

export const TIPOS_ROTINA = ["livre", "estudo", "treino", "corrida", "refeicao"] as const;
export type TipoRotina = (typeof TIPOS_ROTINA)[number];

export type RotinaOpcaoView = { id: string; nome: string };

export type LocalItem = "checklist" | "habitos";

export type RotinaOcorrenciaView = {
  templateId: string;
  nome: string;
  nota: string | null;
  local: LocalItem;
  horaInicio: string | null;
  horaFim: string | null;
  ordem: number;
  tipo: TipoRotina;
  studyCategoryId: string | null;
  routineId: string | null;
  runSessionId: string | null;
  mealId: string | null;
  metaMinutos: number | null;
  planoId: string | null;
  feito: boolean;
  feitoAuto: boolean;
  /** Alternativas do item ("corrida OU treino") — vazio quando é toggle simples. */
  opcoes: RotinaOpcaoView[];
  /** Qual alternativa foi marcada hoje (null = nenhuma / item sem opções). */
  opcaoEscolhidaId: string | null;
  /** Segundos líquidos executados hoje na categoria vinculada (só tipo estudo). */
  executadoSec: number;
};

type RotinaTemplateDb = RotinaTemplateRow & {
  nota: string | null;
  local: string;
  ordem: number;
  tipo: string;
  studyCategoryId: string | null;
  routineId: string | null;
  runSessionId: string | null;
  mealId: string | null;
  metaMinutos: number | null;
  planoId: string | null;
  opcoes: { id: string; nome: string; ordem: number }[];
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

  // Os campos vêm do TEMPLATE, não de `oc.event`: templateParaEventLike só
  // copia o que o motor de recorrência precisa (id/título/datas/rrule), então
  // ler tipo/ordem/vínculos de lá devolvia undefined em silêncio — item de
  // estudo sem barra de progresso, emoji genérico, ordenação por NaN.
  // expandEvent devolve 0 ou 1 ocorrência para a janela de um dia.
  const ocorrencias = templates
    .flatMap((t) => {
      const ocorre = expandEvent(templateParaEventLike(t), from, to).length > 0;
      if (!ocorre) return [];
      const check = checks.get(t.id);
      return [
        {
          templateId: t.id,
          nome: t.nome,
          nota: t.nota,
          local: (t.local === "habitos" ? "habitos" : "checklist") as LocalItem,
          horaInicio: t.horaInicio,
          horaFim: t.horaFim,
          ordem: t.ordem,
          tipo: t.tipo as TipoRotina,
          studyCategoryId: t.studyCategoryId,
          routineId: t.routineId,
          runSessionId: t.runSessionId,
          mealId: t.mealId,
          metaMinutos: t.metaMinutos,
          planoId: t.planoId,
          feito: check !== undefined,
          feitoAuto: check?.feitoAuto ?? false,
          opcoes: t.opcoes.map((o) => ({ id: o.id, nome: o.nome })),
          opcaoEscolhidaId: check?.opcaoId ?? null,
          executadoSec: 0,
        },
      ];
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
  cacheLife("usuario");

  const ref = refDoDiaSP(dia);
  const de = spStartOfDay(subDays(ref, dias - 1));
  const ate = spEndOfDay(ref);

  const [todosTemplates, checks] = await Promise.all([
    templatesAtivos(userId),
    db.rotinaCheckDia.findMany({
      where: { userId, data: { gte: de, lte: ate } },
      select: { rotinaId: true, data: true },
    }),
  ]);
  // Item de refeição não tem RotinaCheckDia — o "feito" mora no DietDayLog (ver
  // rotinasDoDia). Contá-lo aqui deixaria o % da semana permanentemente abaixo
  // do real, porque ele nunca apareceria como concluído.
  const templates = todosTemplates.filter((t) => t.tipo !== "refeicao");

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
  cacheLife("usuario");
  const templates = await db.rotinaTemplate.findMany({
    where: { userId, ativo: true },
    orderBy: { ordem: "asc" },
    include: {
      opcoes: {
        orderBy: { ordem: "asc" },
        select: { id: true, nome: true, ordem: true },
      },
    },
  });
  return templates as RotinaTemplateDb[];
}

/** Id do plano vigente no dia: escolha explícita (RotinaDiaPlano), senão o padrão do usuário. */
async function planoAtivoNoDia(userId: string, dayKey: string): Promise<string | null> {
  "use cache";
  cacheTag(tagUsuario(userId, "checklist"));
  cacheLife("usuario");
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

/** Map templateId → dados do check, para as ocorrências marcadas no dia. */
async function checksDoDia(
  userId: string,
  dayKey: string
): Promise<Map<string, { feitoAuto: boolean; opcaoId: string | null }>> {
  "use cache";
  cacheTag(tagUsuario(userId, "checklist"));
  cacheLife("usuario");
  const ref = refDoDiaSP(dayKey);
  const checks = await db.rotinaCheckDia.findMany({
    where: { userId, data: { gte: spStartOfDay(ref), lte: spEndOfDay(ref) } },
    select: { rotinaId: true, feitoAuto: true, opcaoId: true },
  });
  return new Map(checks.map((c) => [c.rotinaId, { feitoAuto: c.feitoAuto, opcaoId: c.opcaoId }]));
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
  cacheLife("usuario");
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
  nota: string | null;
  local: LocalItem;
  horaInicio: string | null;
  horaFim: string | null;
  rrule: string | null;
  exdates: string[];
  ordem: number;
  tipo: TipoRotina;
  studyCategoryId: string | null;
  routineId: string | null;
  runSessionId: string | null;
  mealId: string | null;
  metaMinutos: number | null;
  planoId: string | null;
  opcoes: RotinaOpcaoView[];
};

/** Todos os templates ativos do usuário, para a lista de gerenciamento. */
export async function rotinaTemplates(userId: string): Promise<RotinaTemplateView[]> {
  const templates = await templatesAtivos(userId);
  return templates.map((t) => ({
    id: t.id,
    nome: t.nome,
    nota: t.nota,
    local: (t.local === "habitos" ? "habitos" : "checklist") as LocalItem,
    horaInicio: t.horaInicio,
    horaFim: t.horaFim,
    rrule: t.rrule,
    exdates: safeArray(t.exdates),
    ordem: t.ordem,
    tipo: t.tipo as TipoRotina,
    studyCategoryId: t.studyCategoryId,
    routineId: t.routineId,
    runSessionId: t.runSessionId,
    mealId: t.mealId,
    metaMinutos: t.metaMinutos,
    planoId: t.planoId,
    opcoes: t.opcoes.map((o) => ({ id: o.id, nome: o.nome })),
  }));
}

/** Refeições da dieta ativa, para vincular a um item tipo "refeicao". */
export async function refeicoesParaPlano(userId: string): Promise<RotinaOpcao[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "dieta"));
  cacheLife("usuario");
  const dieta = await db.diet.findFirst({
    where: { userId, ativa: true },
    select: {
      meals: { orderBy: { ordem: "asc" }, select: { id: true, nome: true, horario: true } },
    },
  });
  return (dieta?.meals ?? []).map((m) => ({ id: m.id, nome: m.nome, foco: m.horario }));
}

// ---------- Planos alternativos (Plano A / Plano B / ...) ----------

export type RotinaPlanoView = { id: string; nome: string; padrao: boolean; ordem: number };

/** Todos os planos ativos do usuário, ordenados (padrão sempre existe se houver ao menos 1). */
export async function rotinaPlanos(userId: string): Promise<RotinaPlanoView[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "checklist"));
  cacheLife("usuario");
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

// ---------- Semana montada (ver o checklist inteiro de uma vez) ----------

export type ItemSemana = {
  /** Estável dentro do dia — templateId, ou "meal:<id>" p/ refeição da dieta. */
  id: string;
  nome: string;
  horaInicio: string | null;
  horaFim: string | null;
  tipo: TipoRotina;
  /** null = item comum (aparece em qualquer plano). */
  planoId: string | null;
  /** Nomes das alternativas ("corrida OU treino"), vazio quando não há. */
  opcoes: string[];
};

export type DiaSemanaMontado = {
  dayKey: string;
  /** "Segunda", "Terça"… */
  diaSemana: string;
  /** "04/08" */
  dataLabel: string;
  hoje: boolean;
  fimDeSemana: boolean;
  itens: ItemSemana[];
};

/**
 * A semana inteira já montada, dia a dia — o que o checklist VAI pedir em cada
 * um dos 7 dias, ordenado por horário. Devolve os itens de TODOS os planos com
 * o `planoId` de cada um: quem chama filtra (a tela deixa alternar entre Plano
 * A/B sem ida ao servidor). Semana começa na segunda, e as refeições da dieta
 * ativa que não têm item próprio entram em todos os dias, no horário delas.
 */
export async function semanaMontada(userId: string, ref: Date): Promise<DiaSemanaMontado[]> {
  return semanaMontadaDoDia(userId, dayKeySP(ref));
}

async function semanaMontadaDoDia(userId: string, hojeKey: string): Promise<DiaSemanaMontado[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "checklist"));
  cacheTag(tagUsuario(userId, "dieta"));
  cacheLife("usuario");

  const hoje = refDoDiaSP(hojeKey);
  // Semana de segunda a domingo (getDay: 0=dom). No domingo, volta 6 dias.
  const diaDaSemana = Number(fmtSP(hoje, "i")); // 1=segunda … 7=domingo
  const segunda = spStartOfDay(subDays(hoje, diaDaSemana - 1));
  const dias = Array.from({ length: 7 }, (_, i) => addDays(segunda, i));

  const [templates, dieta] = await Promise.all([
    templatesAtivos(userId),
    db.diet.findFirst({
      where: { userId, ativa: true },
      select: {
        meals: { orderBy: { ordem: "asc" }, select: { id: true, nome: true, horario: true } },
      },
    }),
  ]);

  // Só o que mora na lista do dia: itens de Hábitos são "todo dia, sempre
  // igual" e têm bloco próprio — repeti-los nas 7 colunas só faria ruído.
  const doChecklist = templates.filter((t) => t.local !== "habitos");
  const mealsComItem = new Set(
    doChecklist.filter((t) => t.tipo === "refeicao" && t.mealId).map((t) => t.mealId as string)
  );
  const refeicoesSoltas = (dieta?.meals ?? []).filter((m) => !mealsComItem.has(m.id));

  // Uma expansão por template cobrindo a semana toda, e não 7 expansões por dia.
  const porDia = new Map<string, ItemSemana[]>();
  for (const t of doChecklist) {
    const ocorrencias = expandEvent(
      templateParaEventLike(t),
      segunda,
      spEndOfDay(dias[6])
    );
    for (const oc of ocorrencias) {
      const lista = porDia.get(oc.dayKey) ?? [];
      lista.push({
        id: t.id,
        nome: t.nome,
        horaInicio: t.horaInicio,
        horaFim: t.horaFim,
        tipo: t.tipo as TipoRotina,
        planoId: t.planoId,
        opcoes: t.opcoes.map((o) => o.nome),
      });
      porDia.set(oc.dayKey, lista);
    }
  }

  return dias.map((d) => {
    const dayKey = dayKeySP(d);
    const itens = [
      ...(porDia.get(dayKey) ?? []),
      ...refeicoesSoltas.map((m) => ({
        id: `meal:${m.id}`,
        nome: m.nome,
        horaInicio: m.horario,
        horaFim: null,
        tipo: "refeicao" as TipoRotina,
        planoId: null,
        opcoes: [],
      })),
    ].sort(ordenarPorHorario);

    const nomeDia = fmtSP(d, "EEEE").replace(/-feira$/, "");
    return {
      dayKey,
      diaSemana: nomeDia.charAt(0).toUpperCase() + nomeDia.slice(1),
      dataLabel: fmtSP(d, "dd/MM"),
      hoje: dayKey === hojeKey,
      fimDeSemana: [0, 6].includes(Number(fmtSP(d, "i")) % 7),
      itens,
    };
  });
}

/** Itens com hora primeiro (crescente); os sem hora vão para o fim. */
function ordenarPorHorario(a: { horaInicio: string | null }, b: { horaInicio: string | null }): number {
  if (a.horaInicio && b.horaInicio) return a.horaInicio.localeCompare(b.horaInicio);
  if (a.horaInicio) return -1;
  if (b.horaInicio) return 1;
  return 0;
}

function safeArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export type DiaRegistroView = {
  id: string;
  dia: string;
  diaLabel: string;
  descricao: string;
  pct: number;
};

/** Registros de dia (descrição escrita pelo usuário) mais recentes primeiro — timeline do dashboard. */
export async function historicoDiaRegistros(
  userId: string,
  limite = 60
): Promise<DiaRegistroView[]> {
  const registros = await db.diaRegistro.findMany({
    where: { userId },
    orderBy: { data: "desc" },
    take: limite,
  });
  return registros.map((r) => ({
    id: r.id,
    dia: dayKeySP(r.data),
    diaLabel: shortDate(r.data),
    descricao: r.descricao,
    pct: r.pct,
  }));
}

/** Registro do dia (se já escrito), para o form de descrição saber se é criação ou edição. */
export async function diaRegistroDoDia(userId: string, dia: Date): Promise<DiaRegistroView | null> {
  const data = spStartOfDay(dia);
  const r = await db.diaRegistro.findUnique({ where: { userId_data: { userId, data } } });
  if (!r) return null;
  return { id: r.id, dia: dayKeySP(r.data), diaLabel: shortDate(r.data), descricao: r.descricao, pct: r.pct };
}
