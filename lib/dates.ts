import { TZDate } from "@date-fns/tz";
import {
  format,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameDay as dfIsSameDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export const TIMEZONE = "America/Sao_Paulo";

/** Converte um Date (UTC do banco) para TZDate em America/Sao_Paulo. */
export function toSP(date: Date): TZDate {
  return new TZDate(date, TIMEZONE);
}

/** Agora em America/Sao_Paulo. */
export function nowSP(): TZDate {
  return TZDate.tz(TIMEZONE);
}

/** Formata em pt-BR já no fuso de São Paulo. */
export function fmtSP(date: Date, pattern: string): string {
  return format(toSP(date), pattern, { locale: ptBR });
}

/** "quinta-feira, 16 de julho de 2026" */
export function fullDate(date: Date): string {
  return fmtSP(date, "EEEE, d 'de' MMMM 'de' yyyy");
}

/** "16 de jul. de 2026" */
export function mediumDate(date: Date): string {
  return fmtSP(date, "d 'de' MMM'.' 'de' yyyy");
}

/** "16/07" */
export function shortDate(date: Date): string {
  return fmtSP(date, "dd/MM");
}

/** "10:00" */
export function timeHM(date: Date): string {
  return fmtSP(date, "HH:mm");
}

/** "julho de 2026" */
export function monthYear(date: Date): string {
  return fmtSP(date, "MMMM 'de' yyyy");
}

/** "julho" */
export function monthName(date: Date): string {
  return fmtSP(date, "MMMM");
}

/** Início do dia em SP, como Date UTC para query no banco. */
export function spStartOfDay(date: Date): Date {
  return new Date(startOfDay(toSP(date)).getTime());
}

export function spEndOfDay(date: Date): Date {
  return new Date(endOfDay(toSP(date)).getTime());
}

export function spStartOfMonth(date: Date): Date {
  return new Date(startOfMonth(toSP(date)).getTime());
}

export function spEndOfMonth(date: Date): Date {
  return new Date(endOfMonth(toSP(date)).getTime());
}

/** Semana começando no DOMINGO (padrão brasileiro / Google Agenda). */
export function spStartOfWeek(date: Date): Date {
  return new Date(startOfWeek(toSP(date), { weekStartsOn: 0 }).getTime());
}

export function spEndOfWeek(date: Date): Date {
  return new Date(endOfWeek(toSP(date), { weekStartsOn: 0 }).getTime());
}

/** Mesmo dia no fuso de SP. */
export function isSameDaySP(a: Date, b: Date): boolean {
  return dfIsSameDay(toSP(a), toSP(b));
}

/** Chave "yyyy-MM-dd" no fuso de SP. */
export function dayKeySP(date: Date): string {
  return fmtSP(date, "yyyy-MM-dd");
}

/** Chave "yyyy-MM" no fuso de SP. */
export function monthKeySP(date: Date): string {
  return fmtSP(date, "yyyy-MM");
}
