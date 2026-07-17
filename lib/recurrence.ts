import { TZDate } from "@date-fns/tz";
import {
  addDays,
  addMonths,
  addYears,
  differenceInMilliseconds,
  isAfter,
  isBefore,
} from "date-fns";
import { TIMEZONE, toSP, dayKeySP } from "@/lib/dates";

/**
 * Recorrência simples serializada no campo Event.rrule:
 *   { freq: "daily" | "weekly" | "monthly" | "yearly",
 *     byday?: number[],   // 0=dom ... 6=sáb (apenas weekly)
 *     interval?: number,  // padrão 1
 *     until?: string }    // ISO date (inclusive)
 */
export type Rrule = {
  freq: "daily" | "weekly" | "monthly" | "yearly";
  byday?: number[];
  interval?: number;
  until?: string;
};

export type EventLike = {
  id: string;
  titulo: string;
  inicio: Date;
  fim: Date;
  diaInteiro: boolean;
  rrule: string | null;
  exdates: string;
};

export type Occurrence<E extends EventLike> = {
  event: E;
  inicio: Date;
  fim: Date;
  /** chave da ocorrência ("yyyy-MM-dd" do início em SP) — usada para exdates */
  dayKey: string;
  recorrente: boolean;
};

export function parseRrule(raw: string | null): Rrule | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as Rrule;
    if (!r.freq) return null;
    return r;
  } catch {
    return null;
  }
}

/** Descrição humana no formato do Google Agenda: "Semanal: cada sexta-feira". */
export function describeRrule(raw: string | null): string | null {
  const r = parseRrule(raw);
  if (!r) return null;
  const dias = [
    "domingo",
    "segunda-feira",
    "terça-feira",
    "quarta-feira",
    "quinta-feira",
    "sexta-feira",
    "sábado",
  ];
  switch (r.freq) {
    case "daily":
      return "Todos os dias";
    case "weekly": {
      if (r.byday && r.byday.length > 0) {
        const nomes = r.byday
          .slice()
          .sort()
          .map((d) => dias[d]);
        return `Semanal: cada ${nomes.join(", ")}`;
      }
      return "Semanal";
    }
    case "monthly":
      return "Mensal";
    case "yearly":
      return "Anual";
  }
}

/**
 * Expande as ocorrências de um evento dentro da janela [from, to].
 * Eventos sem rrule retornam a própria ocorrência se intersectar a janela.
 */
export function expandEvent<E extends EventLike>(
  event: E,
  from: Date,
  to: Date
): Occurrence<E>[] {
  const durationMs = differenceInMilliseconds(event.fim, event.inicio);
  const exdates = new Set<string>(safeParseArray(event.exdates));
  const rule = parseRrule(event.rrule);

  if (!rule) {
    if (event.fim >= from && event.inicio <= to) {
      const key = dayKeySP(event.inicio);
      if (exdates.has(key)) return [];
      return [
        {
          event,
          inicio: event.inicio,
          fim: event.fim,
          dayKey: key,
          recorrente: false,
        },
      ];
    }
    return [];
  }

  const interval = rule.interval && rule.interval > 0 ? rule.interval : 1;
  const until = rule.until ? new Date(rule.until) : null;
  const out: Occurrence<E>[] = [];
  // trabalhar no fuso de SP para que dia-da-semana/dia-do-mês fiquem corretos
  let cursor = new TZDate(event.inicio, TIMEZONE);
  const hardLimit = 730; // segurança: máx. 2 anos de ocorrências por chamada
  let steps = 0;

  while (steps < hardLimit) {
    steps++;
    const occStart = new Date(cursor.getTime());
    const occEnd = new Date(cursor.getTime() + durationMs);
    if (until && isAfter(occStart, addDays(until, 1))) break;
    if (isAfter(occStart, to)) break;

    const matches =
      rule.freq !== "weekly" ||
      !rule.byday ||
      rule.byday.length === 0 ||
      rule.byday.includes(toSP(occStart).getDay());

    if (matches && occEnd >= from && !isBefore(occStart, event.inicio)) {
      const key = dayKeySP(occStart);
      if (!exdates.has(key)) {
        out.push({
          event,
          inicio: occStart,
          fim: occEnd,
          dayKey: key,
          recorrente: true,
        });
      }
    }

    switch (rule.freq) {
      case "daily":
        cursor = addDays(cursor, interval);
        break;
      case "weekly":
        // com byday, caminha dia a dia; sem byday, pula semanas
        cursor =
          rule.byday && rule.byday.length > 0
            ? addDays(cursor, 1)
            : addDays(cursor, 7 * interval);
        break;
      case "monthly":
        cursor = addMonths(cursor, interval);
        break;
      case "yearly":
        cursor = addYears(cursor, interval);
        break;
    }
  }

  return out;
}

/** Expande uma lista de eventos e ordena por início. */
export function expandEvents<E extends EventLike>(
  events: E[],
  from: Date,
  to: Date
): Occurrence<E>[] {
  return events
    .flatMap((e) => expandEvent(e, from, to))
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}

function safeParseArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
