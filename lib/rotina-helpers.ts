import { addDays } from "date-fns";
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

/**
 * Por que um item aparece (ou não) no checklist de um dia.
 *
 * Um item pode ser gravado com sucesso e mesmo assim não entrar na lista — por
 * estar em outro plano, ou por ter recorrência que não cai naquele dia. Na tela
 * isso é indistinguível de "salvar não funcionou", então a razão precisa ser
 * calculada e dita ao usuário. Parte pura: quem chama já buscou o banco.
 */
export type ItemDiagnostico = {
  apareceHoje: boolean;
  /** "plano" = está em outro plano; "recorrencia" = não cai neste dia */
  motivo: "plano" | "recorrencia" | null;
  /** Nome do plano do item (null = item comum, aparece em qualquer plano). */
  planoNome: string | null;
  /** Nome do plano vigente no dia. */
  planoDoDiaNome: string | null;
  /** Próxima data em que o item cai, se houver dentro da janela consultada. */
  proximaOcorrencia: Date | null;
};

export function diagnosticarTemplate({
  template,
  planoId,
  planoDoDiaId,
  planos,
  dia,
  janelaDias = 365,
}: {
  template: RotinaTemplateRow;
  /** Plano do item (null = comum). */
  planoId: string | null;
  /** Plano vigente no dia (escolha explícita ou padrão). */
  planoDoDiaId: string | null;
  planos: { id: string; nome: string }[];
  dia: Date;
  janelaDias?: number;
}): ItemDiagnostico {
  const noPlanoDoDia = planoId === null || planoId === planoDoDiaId;
  const caiHoje = templateOcorreNoDia(template, dia);

  // A próxima ocorrência só interessa quando o motivo é recorrência; 1 ano
  // cobre semanal/mensal/anual sem estourar o hardLimit do expandEvent.
  const proxima = caiHoje
    ? null
    : expandEvent(
        templateParaEventLike(template),
        spStartOfDay(addDays(dia, 1)),
        spEndOfDay(addDays(dia, janelaDias))
      )[0];

  return {
    apareceHoje: caiHoje && noPlanoDoDia,
    motivo: !caiHoje ? "recorrencia" : noPlanoDoDia ? null : "plano",
    planoNome: planos.find((p) => p.id === planoId)?.nome ?? null,
    planoDoDiaNome: planos.find((p) => p.id === planoDoDiaId)?.nome ?? null,
    proximaOcorrencia: proxima?.inicio ?? null,
  };
}
