import { TZDate } from "@date-fns/tz";
import {
  format,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  addMonths,
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

export function spAddMonths(date: Date, meses: number): Date {
  return new Date(addMonths(toSP(date), meses).getTime());
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

/**
 * Meia-noite em SP a partir dos componentes da data.
 *
 * NÃO usar `new TZDate("yyyy-MM-ddT00:00:00", TIMEZONE)`: com string sem
 * offset, o TZDate faz o parse no fuso DO SISTEMA e só depois representa em
 * SP. Na Vercel (TZ=UTC) isso devolvia meia-noite UTC — 21h do dia anterior
 * em SP — e todo WHERE por dia caía um dia atrás. Sintoma: itens salvos não
 * apareciam no checklist, e só em produção (na máquina do dev, com
 * TZ=America/Sao_Paulo, os dois caminhos coincidiam e tudo parecia certo).
 *
 * O construtor por componentes monta o instante JÁ no fuso informado, e por
 * usar a zona IANA (não um offset fixo "-03:00") continua correto se o
 * Brasil voltar a ter horário de verão.
 */
function meiaNoiteSP(ano: number, mes1a12: number, dia: number): Date {
  return new Date(TZDate.tz(TIMEZONE, ano, mes1a12 - 1, dia).getTime());
}

/**
 * Inverso de dayKeySP: converte a chave "yyyy-MM-dd" de volta para o início
 * do dia em SP. Usado pelas funções cacheadas ("use cache"), cujos argumentos
 * precisam ser chaves estáveis por dia — nunca um instante por request.
 */
export function refDoDiaSP(dayKey: string): Date {
  const [ano, mes, dia] = dayKey.split("-").map(Number);
  return meiaNoiteSP(ano, mes, dia);
}

/** Chave "yyyy-MM" no fuso de SP. */
export function monthKeySP(date: Date): string {
  return fmtSP(date, "yyyy-MM");
}

/** Inverso de monthKeySP: chave "yyyy-MM" -> um dia dentro do mês em SP. */
export function refDoMesSP(monthKey: string): Date {
  const [ano, mes] = monthKey.split("-").map(Number);
  return meiaNoiteSP(ano, mes, 15);
}

export function spStartOfQuarter(date: Date): Date {
  return new Date(startOfQuarter(toSP(date)).getTime());
}

export function spEndOfQuarter(date: Date): Date {
  return new Date(endOfQuarter(toSP(date)).getTime());
}

export function spStartOfYear(date: Date): Date {
  return new Date(startOfYear(toSP(date)).getTime());
}

export function spEndOfYear(date: Date): Date {
  return new Date(endOfYear(toSP(date)).getTime());
}

/** Chave "yyyy-Qn" no fuso de SP (ex.: "2026-Q3"). */
export function quarterKeySP(date: Date): string {
  const q = Math.floor(toSP(date).getMonth() / 3) + 1;
  return `${fmtSP(date, "yyyy")}-Q${q}`;
}

/** Inverso de quarterKeySP: chave "yyyy-Qn" -> um dia dentro do trimestre em SP. */
export function refDoTrimestreSP(quarterKey: string): Date {
  const [anoStr, qStr] = quarterKey.split("-Q");
  const mesInicial = (Number(qStr) - 1) * 3; // 0, 3, 6, 9
  return meiaNoiteSP(Number(anoStr), mesInicial + 1, 15);
}

/** Chave "yyyy" no fuso de SP. */
export function yearKeySP(date: Date): string {
  return fmtSP(date, "yyyy");
}

/** Inverso de yearKeySP: chave "yyyy" -> um dia dentro do ano em SP. */
export function refDoAnoSP(yearKey: string): Date {
  return meiaNoiteSP(Number(yearKey), 6, 15);
}

/** Chave "yyyy-Www" (semana ISO) no fuso de SP — ex.: "2026-W29". */
export function weekKeySP(date: Date): string {
  return fmtSP(date, "RRRR-'W'II");
}

/** Inverso de weekKeySP: chave "yyyy-Www" -> domingo (início) daquela semana em SP. */
export function refDaSemanaSP(weekKey: string): Date {
  const [anoStr, wStr] = weekKey.split("-W");
  // 4 de janeiro sempre cai na semana ISO 1; a partir dali soma (semana-1) semanas.
  // Aqui o deslocamento de fuso custava uma SEMANA inteira, não um dia: quando
  // 4/jan cai num domingo, voltar 3h joga para o sábado anterior e o
  // spStartOfWeek devolve a semana errada.
  const base = meiaNoiteSP(Number(anoStr), 1, 4);
  const dias = (Number(wStr) - 1) * 7;
  const alvo = new Date(base.getTime() + dias * 86_400_000);
  return spStartOfWeek(alvo);
}

/** Chave "yyyy-Sn" (semestre) no fuso de SP — ex.: "2026-S2". */
export function semesterKeySP(date: Date): string {
  const s = toSP(date).getMonth() < 6 ? 1 : 2;
  return `${fmtSP(date, "yyyy")}-S${s}`;
}

/** Inverso de semesterKeySP: chave "yyyy-Sn" -> um dia dentro do semestre em SP. */
export function refDoSemestreSP(semesterKey: string): Date {
  const [anoStr, sStr] = semesterKey.split("-S");
  return meiaNoiteSP(Number(anoStr), Number(sStr) === 1 ? 2 : 8, 15);
}

export function spStartOfSemester(date: Date): Date {
  const sp = toSP(date);
  const mesInicial = sp.getMonth() < 6 ? 0 : 6;
  return new Date(startOfMonth(new TZDate(sp.getFullYear(), mesInicial, 1, TIMEZONE)).getTime());
}

export function spEndOfSemester(date: Date): Date {
  const sp = toSP(date);
  const mesFinal = sp.getMonth() < 6 ? 5 : 11;
  return new Date(endOfMonth(new TZDate(sp.getFullYear(), mesFinal, 1, TIMEZONE)).getTime());
}
