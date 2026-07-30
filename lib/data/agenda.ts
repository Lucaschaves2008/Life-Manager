import {
  cacheLife,
  cacheTag,
} from "next/cache";
import { db } from "@/lib/db";
import { TAG_FERIADOS, tagUsuario } from "@/lib/cache-tags";
import { dayKeySP, refDoDiaSP, spEndOfDay, spStartOfDay, toSP } from "@/lib/dates";
import { expandEvents, type EventLike } from "@/lib/recurrence";
import { templateParaEventLike, type RotinaEventLike } from "@/lib/rotina-helpers";

// Padrão de cache deste arquivo (igual ao lib/data/home.ts): a função exportada
// mantém a assinatura original e delega para uma interna "use cache" cujos
// argumentos são chaves ESTÁVEIS (userId + dayKey) — nunca um Date de request.
// As actions do módulo chamam revalidateTag na escrita.

export type FeriadoView = { data: string; nome: string };

/**
 * Feriados do ano. Só a leitura da tabela é cacheada; quando vem vazia, o
 * caminho vivo (BrasilAPI + persistência) roda FORA do cache — assim uma
 * falha de rede nunca congela um ano sem feriados até o TTL, e a entrada
 * vazia é contornada a cada request até a tabela ser populada.
 */
export async function getFeriados(ano: number): Promise<FeriadoView[]> {
  const salvos = await feriadosDoAno(ano);
  if (salvos.length > 0) return salvos;
  return buscarEPersistirFeriados(ano);
}

async function feriadosDoAno(ano: number): Promise<FeriadoView[]> {
  "use cache";
  cacheTag(TAG_FERIADOS);
  cacheLife("days");
  const salvos = await db.holiday.findMany({ where: { ano }, orderBy: { data: "asc" } });
  return salvos.map((h) => ({ data: dayKeySP(h.data), nome: h.nome }));
}

async function buscarEPersistirFeriados(ano: number): Promise<FeriadoView[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) return [];

    const dados = (await resp.json()) as { date: string; name: string }[];
    // skipDuplicates: dois cache-miss concorrentes não estouram o @@unique
    await db.holiday.createMany({
      data: dados.map((d) => ({
        data: new Date(`${d.date}T12:00:00-03:00`),
        nome: d.name,
        ano,
      })),
      skipDuplicates: true,
    });
    return dados.map((d) => ({ data: d.date, nome: d.name }));
  } catch {
    // sem rede: devolve o que houver no banco, fora do cache
    const salvos = await db.holiday.findMany({ where: { ano }, orderBy: { data: "asc" } });
    return salvos.map((h) => ({ data: dayKeySP(h.data), nome: h.nome }));
  }
}

export type OcorrenciaView = {
  chave: string;
  eventId: string;
  titulo: string;
  inicio: string;
  fim: string;
  dayKey: string;
  diaInteiro: boolean;
  recorrente: boolean;
  cor: string;
  calendarId: string;
  calendarNome: string;
  local: string | null;
  descricao: string | null;
  tags: string[];
  lembreteMin: number | null;
  rrule: string | null;
  readonly: boolean;
};

type EventoDb = EventLike & {
  local: string | null;
  descricao: string | null;
  tags: string;
  lembreteMin: number | null;
  calendarId: string;
  calendar: { nome: string; cor: string; readonly: boolean; visivel: boolean };
};

/** Ocorrências das agendas visíveis dentro da janela. */
export async function ocorrencias(
  userId: string,
  from: Date,
  to: Date
): Promise<OcorrenciaView[]> {
  return ocorrenciasDaJanela(userId, dayKeySP(from), dayKeySP(to));
}

async function ocorrenciasDaJanela(
  userId: string,
  diaDe: string,
  diaAte: string
): Promise<OcorrenciaView[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "agenda"));
  cacheLife("days");

  const from = refDoDiaSP(diaDe);
  const to = spEndOfDay(refDoDiaSP(diaAte));

  // recorrentes vêm sempre (expandEvents decide as ocorrências); únicos só se intersectam a janela
  const eventos = (await db.event.findMany({
    where: {
      userId,
      calendar: { visivel: true },
      OR: [{ rrule: { not: null } }, { inicio: { lte: to }, fim: { gte: from } }],
    },
    include: { calendar: true },
  })) as unknown as EventoDb[];

  return expandEvents(eventos, from, to).map((oc) => ({
    chave: `${oc.event.id}-${oc.dayKey}`,
    eventId: oc.event.id,
    titulo: oc.event.titulo,
    inicio: oc.inicio.toISOString(),
    fim: oc.fim.toISOString(),
    dayKey: oc.dayKey,
    diaInteiro: oc.event.diaInteiro,
    recorrente: oc.recorrente,
    cor: oc.event.calendar.cor,
    calendarId: oc.event.calendarId,
    calendarNome: oc.event.calendar.nome,
    local: oc.event.local,
    descricao: oc.event.descricao,
    tags: safeArray(oc.event.tags),
    lembreteMin: oc.event.lembreteMin,
    rrule: oc.event.rrule,
    readonly: oc.event.calendar.readonly,
  }));
}

/** Feriados como ocorrências de dia inteiro (lilás, somente leitura). */
export async function feriadosComoEventos(
  _userId: string,
  from: Date,
  to: Date
): Promise<OcorrenciaView[]> {
  return feriadosDaJanela(dayKeySP(from), dayKeySP(to));
}

// feriados são globais — cache compartilhado, sem chave por usuário
async function feriadosDaJanela(
  diaDe: string,
  diaAte: string
): Promise<OcorrenciaView[]> {
  "use cache";
  cacheTag(TAG_FERIADOS);
  cacheLife("days");

  const from = refDoDiaSP(diaDe);
  const to = spEndOfDay(refDoDiaSP(diaAte));

  const anos = new Set([toSP(from).getFullYear(), toSP(to).getFullYear()]);
  const listas = await Promise.all(Array.from(anos).map((ano) => getFeriados(ano)));

  return listas
    .flat()
    .filter((f) => {
      const dia = new Date(`${f.data}T12:00:00-03:00`);
      return dia >= spStartOfDay(from) && dia <= spEndOfDay(to);
    })
    .map((f) => {
      const dia = new Date(`${f.data}T12:00:00-03:00`);
      return {
        chave: `feriado-${f.data}`,
        eventId: `feriado-${f.data}`,
        titulo: f.nome,
        inicio: spStartOfDay(dia).toISOString(),
        fim: spEndOfDay(dia).toISOString(),
        dayKey: f.data,
        diaInteiro: true,
        recorrente: false,
        cor: "var(--cal-lilac)",
        calendarId: "feriados",
        calendarNome: "Feriados no Brasil",
        local: null,
        descricao: null,
        tags: [],
        lembreteMin: null,
        rrule: null,
        readonly: true,
      };
    });
}

/**
 * Ocorrências do checklist (templates recorrentes) COM horário, projetadas na
 * janela como ocorrências virtuais (camada só-leitura). Não são Events reais —
 * editam-se no checklist. A cor e o emoji vêm da categoria vinculada (estudo);
 * os demais tipos usam a cor do tipo. Duração = horaFim real, ou meta em
 * minutos, ou 1h por padrão.
 */
export async function planoComoEventos(
  userId: string,
  from: Date,
  to: Date
): Promise<OcorrenciaView[]> {
  return planoDaJanela(userId, dayKeySP(from), dayKeySP(to));
}

const COR_TIPO: Record<string, string> = {
  estudo: "var(--cal-blue)",
  treino: "var(--color-mint)",
  corrida: "var(--cal-teal)",
  livre: "var(--color-steel)",
};

type RotinaTemplateComVinculo = RotinaEventLike & {
  metaMinutos: number | null;
  tipo: string;
  studyCategory: { emoji: string; cor: string } | null;
};

async function planoDaJanela(
  userId: string,
  diaDe: string,
  diaAte: string
): Promise<OcorrenciaView[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "checklist"));
  cacheTag(tagUsuario(userId, "estudos")); // emoji/cor da categoria
  cacheLife("days");

  const from = spStartOfDay(refDoDiaSP(diaDe));
  const to = spEndOfDay(refDoDiaSP(diaAte));

  const templates = await db.rotinaTemplate.findMany({
    where: { userId, ativo: true, horaInicio: { not: null } },
    include: { studyCategory: { select: { emoji: true, cor: true } } },
  });

  const eventLikes = templates.map((t) => ({
    ...templateParaEventLike(t),
    metaMinutos: t.metaMinutos,
    tipo: t.tipo,
    studyCategory: t.studyCategory,
  })) as RotinaTemplateComVinculo[];

  return expandEvents(eventLikes, from, to).map((oc) => {
    const t = oc.event as RotinaTemplateComVinculo;
    const dur = t.horaFim
      ? oc.fim.getTime() - oc.inicio.getTime()
      : (t.metaMinutos && t.metaMinutos > 0 ? t.metaMinutos : 60) * 60 * 1000;
    const fim = new Date(oc.inicio.getTime() + dur);
    const emoji =
      t.studyCategory?.emoji ??
      { estudo: "📚", treino: "💪", corrida: "🏃", livre: "•" }[t.tipo] ??
      "•";
    return {
      chave: `rotina-${t.id}-${oc.dayKey}`,
      eventId: `rotina-${t.id}-${oc.dayKey}`,
      titulo: `${emoji} ${t.titulo}`,
      inicio: oc.inicio.toISOString(),
      fim: fim.toISOString(),
      dayKey: oc.dayKey,
      diaInteiro: false,
      recorrente: oc.recorrente,
      cor: t.studyCategory?.cor ?? COR_TIPO[t.tipo] ?? COR_TIPO.livre,
      calendarId: "plano",
      calendarNome: "Plano do dia",
      local: null,
      descricao: null,
      tags: [],
      lembreteMin: null,
      rrule: null,
      readonly: true,
    };
  });
}

/** userId e eventId já são chaves estáveis — cacheia direto. */
export async function notasDoEvento(userId: string, eventId: string) {
  "use cache";
  cacheTag(tagUsuario(userId, "agenda"));
  cacheLife("days");
  return db.eventNote.findMany({
    where: { userId, eventId },
    orderBy: { criadoEm: "desc" },
  });
}

function safeArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
