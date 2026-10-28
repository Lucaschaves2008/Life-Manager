import type { Rrule } from "@/lib/recurrence";

/** Segunda → domingo: a ordem em que a semana é lida no Gerenciar. */
export const DIAS_SEMANA_ORDEM = [1, 2, 3, 4, 5, 6, 0] as const;
export const DIA_NOME: Record<number, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};
export const DIA_CURTO: Record<number, string> = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
};

/** Dia da semana (0=dom..6=sáb) de um "yyyy-MM-dd". */
export function diaDaSemanaDe(dia: string): number {
  return new Date(`${dia}T12:00:00-03:00`).getUTCDay();
}

function parse(rrule: string | null): Rrule | null {
  if (!rrule) return null;
  try {
    const r = JSON.parse(rrule) as Rrule;
    return r.freq ? r : null;
  } catch {
    return null;
  }
}

/**
 * Em quais dias da semana o item cai. Sem recorrência (ocorrência única) ou
 * semanal sem dias marcados, vale o dia da semana da âncora `dataInicio`.
 */
export function diasDoItem(rrule: string | null, dataInicio: string): number[] {
  const r = parse(rrule);
  if (!r) return [diaDaSemanaDe(dataInicio)];
  if (r.freq === "daily") return [0, 1, 2, 3, 4, 5, 6];
  if (r.freq === "weekly") {
    return r.byday && r.byday.length > 0
      ? [...new Set(r.byday)].sort((a, b) => a - b)
      : [diaDaSemanaDe(dataInicio)];
  }
  return [diaDaSemanaDe(dataInicio)];
}

/** Ocorrência única (sem repetição): some por inteiro ao ser apagada. */
export function ehUnico(rrule: string | null): boolean {
  return parse(rrule) === null;
}
