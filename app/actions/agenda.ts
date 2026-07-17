"use server";

import { subDays } from "date-fns";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { parseJSON } from "@/lib/utils";

function revalidar() {
  revalidatePath("/agenda");
  revalidatePath("/");
}

export type EventoInput = {
  titulo: string;
  /** yyyy-MM-dd */
  dia: string;
  /** HH:mm — ignorados quando diaInteiro */
  horaInicio: string;
  horaFim: string;
  diaInteiro: boolean;
  calendarId: string;
  rrule: string | null;
  local?: string | null;
  descricao?: string | null;
  tags: string[];
  lembreteMin: number | null;
};

function montarDatas(input: EventoInput): { inicio: Date; fim: Date } {
  if (input.diaInteiro) {
    return {
      inicio: new Date(`${input.dia}T00:00:00-03:00`),
      fim: new Date(`${input.dia}T23:59:00-03:00`),
    };
  }
  const inicio = new Date(`${input.dia}T${input.horaInicio}:00-03:00`);
  let fim = new Date(`${input.dia}T${input.horaFim}:00-03:00`);
  if (fim <= inicio) fim = new Date(inicio.getTime() + 60 * 60 * 1000);
  return { inicio, fim };
}

function dados(input: EventoInput) {
  const { inicio, fim } = montarDatas(input);
  return {
    titulo: input.titulo.trim(),
    inicio,
    fim,
    diaInteiro: input.diaInteiro,
    rrule: input.rrule,
    local: input.local?.trim() || null,
    descricao: input.descricao?.trim() || null,
    tags: JSON.stringify(input.tags ?? []),
    lembreteMin: input.lembreteMin,
    calendarId: input.calendarId,
  };
}

export async function createEvent(input: EventoInput) {
  await db.event.create({ data: dados(input) });
  revalidar();
}

/**
 * modo "unica": exclui a ocorrência da série (exdate) e cria um evento avulso editado.
 * modo "seguintes": encerra a série no dia anterior e cria uma nova a partir daqui.
 * modo "todos": edita o evento-pai.
 */
export async function updateEvent(
  id: string,
  input: EventoInput,
  modo: "todos" | "unica" | "seguintes" = "todos",
  dayKeyOriginal?: string
) {
  const original = await db.event.findUnique({ where: { id } });
  if (!original) return;

  if (modo === "todos" || !original.rrule || !dayKeyOriginal) {
    await db.event.update({ where: { id }, data: dados(input) });
    revalidar();
    return;
  }

  if (modo === "unica") {
    const exdates = parseJSON<string[]>(original.exdates, []);
    await db.event.update({
      where: { id },
      data: { exdates: JSON.stringify([...exdates, dayKeyOriginal]) },
    });
    await db.event.create({ data: { ...dados(input), rrule: null } });
    revalidar();
    return;
  }

  // seguintes: a série antiga termina no dia anterior à ocorrência editada
  const rrule = parseJSON<Record<string, unknown>>(original.rrule, {});
  const until = subDays(new Date(`${dayKeyOriginal}T12:00:00-03:00`), 1);
  await db.event.update({
    where: { id },
    data: { rrule: JSON.stringify({ ...rrule, until: until.toISOString() }) },
  });
  await db.event.create({ data: dados(input) });
  revalidar();
}

export async function deleteEvent(
  id: string,
  modo: "todos" | "unica" | "seguintes" = "todos",
  dayKey?: string
) {
  const evento = await db.event.findUnique({ where: { id } });
  if (!evento) return null;

  if (modo === "unica" && evento.rrule && dayKey) {
    const exdates = parseJSON<string[]>(evento.exdates, []);
    await db.event.update({
      where: { id },
      data: { exdates: JSON.stringify([...exdates, dayKey]) },
    });
    revalidar();
    return null;
  }

  if (modo === "seguintes" && evento.rrule && dayKey) {
    const rrule = parseJSON<Record<string, unknown>>(evento.rrule, {});
    const until = subDays(new Date(`${dayKey}T12:00:00-03:00`), 1);
    await db.event.update({
      where: { id },
      data: { rrule: JSON.stringify({ ...rrule, until: until.toISOString() }) },
    });
    revalidar();
    return null;
  }

  await db.event.delete({ where: { id } });
  revalidar();
  return evento;
}

export async function restoreEvent(dados: {
  titulo: string;
  inicio: Date;
  fim: Date;
  diaInteiro: boolean;
  rrule: string | null;
  exdates: string;
  local: string | null;
  descricao: string | null;
  tags: string;
  lembreteMin: number | null;
  calendarId: string;
}) {
  await db.event.create({ data: dados });
  revalidar();
}

export async function duplicateEvent(id: string) {
  const evento = await db.event.findUnique({ where: { id } });
  if (!evento) return;
  const { id: _id, ...resto } = evento;
  await db.event.create({ data: { ...resto, titulo: `${evento.titulo} (cópia)` } });
  revalidar();
}

// ---------- Agendas ----------

export async function createCalendar(nome: string, cor: string) {
  const total = await db.calendar.count();
  await db.calendar.create({ data: { nome, cor, ordem: total } });
  revalidar();
}

export async function updateCalendar(id: string, nome: string, cor: string) {
  const cal = await db.calendar.findUnique({ where: { id } });
  if (cal?.readonly) return;
  await db.calendar.update({ where: { id }, data: { nome, cor } });
  revalidar();
}

export async function deleteCalendar(id: string) {
  const cal = await db.calendar.findUnique({ where: { id } });
  if (cal?.readonly) return;
  await db.calendar.delete({ where: { id } });
  revalidar();
}

export async function toggleCalendarVisivel(id: string, visivel: boolean) {
  await db.calendar.update({ where: { id }, data: { visivel } });
  revalidar();
}

// ---------- Notas do evento ----------

export async function addEventNote(eventId: string, texto: string) {
  if (!texto.trim()) return;
  await db.eventNote.create({ data: { eventId, texto: texto.trim() } });
  revalidar();
}

export async function deleteEventNote(id: string) {
  await db.eventNote.delete({ where: { id } });
  revalidar();
}

/** Notas de um evento (usado pelo popover de detalhe). */
export async function getEventNotes(eventId: string) {
  const notas = await db.eventNote.findMany({
    where: { eventId },
    orderBy: { criadoEm: "desc" },
  });
  return notas.map((n) => ({
    id: n.id,
    texto: n.texto,
    criadoEm: n.criadoEm.toISOString(),
  }));
}
