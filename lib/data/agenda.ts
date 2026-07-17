import { db } from "@/lib/db";
import { dayKeySP, spEndOfDay, spStartOfDay, toSP } from "@/lib/dates";
import { expandEvents, type EventLike } from "@/lib/recurrence";

export type FeriadoView = { data: string; nome: string };

/**
 * Feriados do ano: lê a tabela Holiday; se o ano não existir, busca na BrasilAPI
 * e persiste. Falha de rede não quebra a agenda — retorna o que houver.
 */
export async function getFeriados(ano: number): Promise<FeriadoView[]> {
  const salvos = await db.holiday.findMany({ where: { ano }, orderBy: { data: "asc" } });
  if (salvos.length > 0) {
    return salvos.map((h) => ({ data: dayKeySP(h.data), nome: h.nome }));
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!resp.ok) return [];

    const dados = (await resp.json()) as { date: string; name: string }[];
    await db.holiday.createMany({
      data: dados.map((d) => ({
        data: new Date(`${d.date}T12:00:00-03:00`),
        nome: d.name,
        ano,
      })),
    });
    return dados.map((d) => ({ data: d.date, nome: d.name }));
  } catch {
    return [];
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
export async function ocorrencias(from: Date, to: Date): Promise<OcorrenciaView[]> {
  const eventos = (await db.event.findMany({
    where: { calendar: { visivel: true } },
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
  from: Date,
  to: Date
): Promise<OcorrenciaView[]> {
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

export async function notasDoEvento(eventId: string) {
  return db.eventNote.findMany({
    where: { eventId },
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
