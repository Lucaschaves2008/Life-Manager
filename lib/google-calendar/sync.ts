import "server-only";
import { calendar_v3 } from "googleapis";
import { db } from "@/lib/db";
import { getCalendarClient } from "./client";
import { toSP, dayKeySP } from "@/lib/dates";
import type { Event } from "@prisma/client";

export async function syncToGoogle(
  userId: string,
  evento: Event & { calendar: { googleId: string | null } }
): Promise<void> {
  try {
    const calendar = await getCalendarClient(userId);
    const googleCalendarId = evento.calendar.googleId || "primary";

    const googleEvent: calendar_v3.Schema$Event = {
      summary: evento.titulo,
      description: evento.descricao || undefined,
      location: evento.local || undefined,
      start: evento.diaInteiro
        ? {
            date: dayKeySP(evento.inicio),
          }
        : {
            dateTime: evento.inicio.toISOString(),
            timeZone: "America/Sao_Paulo",
          },
      end: evento.diaInteiro
        ? {
            date: dayKeySP(new Date(evento.fim.getTime() + 86400000)),
          }
        : {
            dateTime: evento.fim.toISOString(),
            timeZone: "America/Sao_Paulo",
          },
      recurrence: evento.rrule
        ? [parseRRuleForGoogle(evento.rrule)]
        : undefined,
      reminders: evento.lembreteMin
        ? {
            useDefault: false,
            overrides: [
              {
                method: "notification",
                minutes: evento.lembreteMin,
              },
            ],
          }
        : undefined,
    };

    // Criar evento no Google (sem ID significa novo)
    await calendar.events.insert({
      calendarId: googleCalendarId,
      requestBody: googleEvent,
    });
  } catch (error) {
    console.error("[Google Calendar] Erro ao sincronizar evento:", error);
  }
}

export async function updateOnGoogle(
  userId: string,
  eventId: string,
  evento: Event & { calendar: { googleId: string | null } }
): Promise<void> {
  try {
    const calendar = await getCalendarClient(userId);
    const googleCalendarId = evento.calendar.googleId || "primary";

    const googleEvent: calendar_v3.Schema$Event = {
      summary: evento.titulo,
      description: evento.descricao || undefined,
      location: evento.local || undefined,
      start: evento.diaInteiro
        ? {
            date: dayKeySP(evento.inicio),
          }
        : {
            dateTime: evento.inicio.toISOString(),
            timeZone: "America/Sao_Paulo",
          },
      end: evento.diaInteiro
        ? {
            date: dayKeySP(new Date(evento.fim.getTime() + 86400000)),
          }
        : {
            dateTime: evento.fim.toISOString(),
            timeZone: "America/Sao_Paulo",
          },
      recurrence: evento.rrule
        ? [parseRRuleForGoogle(evento.rrule)]
        : undefined,
      reminders: evento.lembreteMin
        ? {
            useDefault: false,
            overrides: [
              {
                method: "notification",
                minutes: evento.lembreteMin,
              },
            ],
          }
        : undefined,
    };

    await calendar.events.update({
      calendarId: googleCalendarId,
      eventId,
      requestBody: googleEvent,
    });
  } catch (error) {
    console.error("[Google Calendar] Erro ao atualizar evento:", error);
  }
}

export async function deleteFromGoogle(
  userId: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  try {
    const calendar = await getCalendarClient(userId);
    const googleCalendarId =
      (await db.calendar.findUnique({
        where: { id: calendarId },
        select: { googleId: true },
      }))?.googleId || "primary";

    await calendar.events.delete({
      calendarId: googleCalendarId,
      eventId,
    });
  } catch (error) {
    console.error("[Google Calendar] Erro ao deletar evento:", error);
  }
}

function parseRRuleForGoogle(rruleJson: string | null): string {
  if (!rruleJson) return "";
  try {
    const rule = JSON.parse(rruleJson);
    const parts: string[] = ["RRULE:"];

    if (rule.freq) {
      const freqMap: Record<string, string> = {
        DAILY: "DAILY",
        WEEKLY: "WEEKLY",
        MONTHLY: "MONTHLY",
        YEARLY: "YEARLY",
      };
      parts.push(`FREQ=${freqMap[rule.freq] || rule.freq}`);
    }

    if (rule.interval && rule.interval > 1) {
      parts.push(`INTERVAL=${rule.interval}`);
    }

    if (rule.count) {
      parts.push(`COUNT=${rule.count}`);
    }

    if (rule.until) {
      const until = new Date(rule.until);
      parts.push(`UNTIL=${until.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`);
    }

    if (rule.byweekday && Array.isArray(rule.byweekday)) {
      const dayMap: Record<string, string> = {
        MO: "MO",
        TU: "TU",
        WE: "WE",
        TH: "TH",
        FR: "FR",
        SA: "SA",
        SU: "SU",
      };
      const days = rule.byweekday.map((d: string) => dayMap[d] || d).join(",");
      parts.push(`BYDAY=${days}`);
    }

    return parts.join(";");
  } catch {
    return "";
  }
}
