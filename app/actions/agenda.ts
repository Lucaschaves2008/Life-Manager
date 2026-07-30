"use server";

import { subDays } from "date-fns";
import { revalidatePath, revalidateTag } from "@/lib/cache-revalidate";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { tagUsuario } from "@/lib/cache-tags";
import { parseJSON } from "@/lib/utils";
import { syncToGoogle, updateOnGoogle, deleteFromGoogle } from "@/lib/google-calendar/sync";

function revalidar(userId: string) {
  revalidateTag(tagUsuario(userId, "agenda"));
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

/** Garante que a agenda pertence ao usuário antes de gravar eventos nela. */
async function validarCalendario(calendarId: string, userId: string) {
  const cal = await db.calendar.findFirst({
    where: { id: calendarId, userId },
    select: { id: true },
  });
  if (!cal) throw new Error("Recurso não encontrado.");
}

export async function createEvent(input: EventoInput) {
  const { id: userId } = await requireUser();
  await validarCalendario(input.calendarId, userId);
  const evento = await db.event.create({
    data: { ...dados(input), userId },
    include: { calendar: true },
  });

  if (evento.calendar.googleId) {
    try {
      await syncToGoogle(userId, evento);
    } catch (error) {
      console.error("[Google Calendar] Erro ao sincronizar:", error);
    }
  }

  revalidar(userId);
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
  const { id: userId } = await requireUser();
  const original = await db.event.findFirst({
    where: { id, userId },
    include: { calendar: true },
  });
  if (!original) return;
  await validarCalendario(input.calendarId, userId);

  if (modo === "todos" || !original.rrule || !dayKeyOriginal) {
    const updated = await db.event.update({
      where: { id, userId },
      data: dados(input),
      include: { calendar: true },
    });

    if (updated.calendar.googleId) {
      try {
        await updateOnGoogle(userId, id, updated);
      } catch (error) {
        console.error("[Google Calendar] Erro ao atualizar:", error);
      }
    }

    revalidar(userId);
    return;
  }

  if (modo === "unica") {
    const exdates = parseJSON<string[]>(original.exdates, []);
    await db.event.update({
      where: { id, userId },
      data: { exdates: JSON.stringify([...exdates, dayKeyOriginal]) },
    });
    const novoEvento = await db.event.create({
      data: { ...dados(input), userId, rrule: null },
      include: { calendar: true },
    });

    if (novoEvento.calendar.googleId) {
      try {
        await syncToGoogle(userId, novoEvento);
      } catch (error) {
        console.error("[Google Calendar] Erro ao sincronizar:", error);
      }
    }

    revalidar(userId);
    return;
  }

  // seguintes: a série antiga termina no dia anterior à ocorrência editada
  const rrule = parseJSON<Record<string, unknown>>(original.rrule, {});
  const until = subDays(new Date(`${dayKeyOriginal}T12:00:00-03:00`), 1);
  await db.event.update({
    where: { id, userId },
    data: { rrule: JSON.stringify({ ...rrule, until: until.toISOString() }) },
  });
  const novoEvento = await db.event.create({
    data: { ...dados(input), userId },
    include: { calendar: true },
  });

  if (novoEvento.calendar.googleId) {
    try {
      await syncToGoogle(userId, novoEvento);
    } catch (error) {
      console.error("[Google Calendar] Erro ao sincronizar:", error);
    }
  }

  revalidar(userId);
}

export async function deleteEvent(
  id: string,
  modo: "todos" | "unica" | "seguintes" = "todos",
  dayKey?: string
) {
  const { id: userId } = await requireUser();
  const evento = await db.event.findFirst({
    where: { id, userId },
    include: { calendar: true },
  });
  if (!evento) return null;

  if (modo === "unica" && evento.rrule && dayKey) {
    const exdates = parseJSON<string[]>(evento.exdates, []);
    await db.event.update({
      where: { id, userId },
      data: { exdates: JSON.stringify([...exdates, dayKey]) },
    });
    revalidar(userId);
    return null;
  }

  if (modo === "seguintes" && evento.rrule && dayKey) {
    const rrule = parseJSON<Record<string, unknown>>(evento.rrule, {});
    const until = subDays(new Date(`${dayKey}T12:00:00-03:00`), 1);
    await db.event.update({
      where: { id, userId },
      data: { rrule: JSON.stringify({ ...rrule, until: until.toISOString() }) },
    });
    revalidar(userId);
    return null;
  }

  await db.event.delete({ where: { id, userId } });

  if (evento.calendar.googleId) {
    try {
      await deleteFromGoogle(userId, evento.calendarId, id);
    } catch (error) {
      console.error("[Google Calendar] Erro ao deletar:", error);
    }
  }

  revalidar(userId);
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
  const { id: userId } = await requireUser();
  await validarCalendario(dados.calendarId, userId);
  await db.event.create({ data: { ...dados, userId } });
  revalidar(userId);
}

export async function duplicateEvent(id: string) {
  const { id: userId } = await requireUser();
  const evento = await db.event.findFirst({ where: { id, userId } });
  if (!evento) return;
  const { id: _id, ...resto } = evento;
  await db.event.create({
    data: { ...resto, userId, titulo: `${evento.titulo} (cópia)` },
  });
  revalidar(userId);
}

// ---------- Agendas ----------

export async function createCalendar(nome: string, cor: string) {
  const { id: userId } = await requireUser();
  const total = await db.calendar.count({ where: { userId } });
  await db.calendar.create({ data: { nome, cor, ordem: total, userId } });
  revalidar(userId);
}

export async function updateCalendar(id: string, nome: string, cor: string) {
  const { id: userId } = await requireUser();
  const cal = await db.calendar.findFirst({ where: { id, userId } });
  if (cal?.readonly) return;
  await db.calendar.update({ where: { id, userId }, data: { nome, cor } });
  revalidar(userId);
}

export async function deleteCalendar(id: string) {
  const { id: userId } = await requireUser();
  const cal = await db.calendar.findFirst({ where: { id, userId } });
  if (cal?.readonly) return;
  await db.calendar.delete({ where: { id, userId } });
  revalidar(userId);
}

export async function toggleCalendarVisivel(id: string, visivel: boolean) {
  const { id: userId } = await requireUser();
  await db.calendar.update({ where: { id, userId }, data: { visivel } });
  revalidar(userId);
}

// ---------- Notas do evento ----------

export async function addEventNote(eventId: string, texto: string) {
  const { id: userId } = await requireUser();
  if (!texto.trim()) return;
  const evento = await db.event.findFirst({
    where: { id: eventId, userId },
    select: { id: true },
  });
  if (!evento) throw new Error("Recurso não encontrado.");
  await db.eventNote.create({ data: { eventId, texto: texto.trim(), userId } });
  revalidar(userId);
}

export async function deleteEventNote(id: string) {
  const { id: userId } = await requireUser();
  await db.eventNote.delete({ where: { id, userId } });
  revalidar(userId);
}

/** Notas de um evento (usado pelo popover de detalhe). */
export async function getEventNotes(eventId: string) {
  const { id: userId } = await requireUser();
  const notas = await db.eventNote.findMany({
    where: { userId, eventId },
    orderBy: { criadoEm: "desc" },
  });
  return notas.map((n) => ({
    id: n.id,
    texto: n.texto,
    criadoEm: n.criadoEm.toISOString(),
  }));
}
