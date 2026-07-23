import { dayKeySP, spEndOfDay, spStartOfDay } from "@/lib/dates";
import { expandEvent, type EventLike } from "@/lib/recurrence";

export type RotinaTemplateRow = {
  id: string;
  nome: string;
  horaInicio: string | null;
  horaFim: string | null;
  dataInicio: Date;
  rrule: string | null;
  exdates: string;
};

export type RotinaEventLike = EventLike & {
  horaInicio: string | null;
  horaFim: string | null;
};

/**
 * Converte um RotinaTemplate num EventLike p/ o motor de recorrência
 * (lib/recurrence.ts). Quando não há horaInicio, sintetiza início=fim=meia-
 * noite do dataInicio — a duração não importa aqui, só a data da ocorrência.
 */
export function templateParaEventLike(t: RotinaTemplateRow): RotinaEventLike {
  const dayKey = dayKeySP(t.dataInicio);
  const inicio = t.horaInicio
    ? new Date(`${dayKey}T${t.horaInicio}:00-03:00`)
    : spStartOfDay(t.dataInicio);
  const fim = t.horaFim
    ? new Date(`${dayKey}T${t.horaFim}:00-03:00`)
    : inicio;
  return {
    id: t.id,
    titulo: t.nome,
    inicio,
    fim,
    diaInteiro: false,
    rrule: t.rrule,
    exdates: t.exdates,
    horaInicio: t.horaInicio,
    horaFim: t.horaFim,
  };
}

/** true se o template tem (ao menos) uma ocorrência no dia informado. */
export function templateOcorreNoDia(t: RotinaTemplateRow, dia: Date): boolean {
  const from = spStartOfDay(dia);
  const to = spEndOfDay(dia);
  return expandEvent(templateParaEventLike(t), from, to).length > 0;
}
