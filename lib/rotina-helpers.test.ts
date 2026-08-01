import { describe, expect, it } from "vitest";
import { diagnosticarTemplate, type RotinaTemplateRow } from "@/lib/rotina-helpers";
import { dayKeySP, refDoDiaSP } from "@/lib/dates";

// 2026-08-01 é um SÁBADO em São Paulo — a data em que o checklist "não
// mostrava" os itens recém-criados.
const SABADO = refDoDiaSP("2026-08-01");
const PLANO_A = "plano-a";
const PLANO_B = "plano-b";
const PLANOS = [
  { id: PLANO_A, nome: "PLANO A" },
  { id: PLANO_B, nome: "PLANO B" },
];

function template(over: Partial<RotinaTemplateRow> = {}): RotinaTemplateRow {
  return {
    id: "t1",
    nome: "Item",
    horaInicio: null,
    horaFim: null,
    dataInicio: SABADO,
    rrule: null,
    exdates: "[]",
    ...over,
  };
}

describe("diagnosticarTemplate", () => {
  it("aparece quando é do plano do dia e cai no dia", () => {
    const d = diagnosticarTemplate({
      template: template(),
      planoId: PLANO_A,
      planoDoDiaId: PLANO_A,
      planos: PLANOS,
      dia: SABADO,
    });
    expect(d.apareceHoje).toBe(true);
    expect(d.motivo).toBeNull();
  });

  it("item comum (sem plano) aparece em qualquer plano do dia", () => {
    const d = diagnosticarTemplate({
      template: template(),
      planoId: null,
      planoDoDiaId: PLANO_B,
      planos: PLANOS,
      dia: SABADO,
    });
    expect(d.apareceHoje).toBe(true);
    expect(d.planoNome).toBeNull();
  });

  it("acusa o plano quando o item é de outro plano — caso TESTE/rwsete", () => {
    const d = diagnosticarTemplate({
      template: template(),
      planoId: PLANO_A,
      planoDoDiaId: PLANO_B,
      planos: PLANOS,
      dia: SABADO,
    });
    expect(d.apareceHoje).toBe(false);
    expect(d.motivo).toBe("plano");
    expect(d.planoNome).toBe("PLANO A");
    expect(d.planoDoDiaNome).toBe("PLANO B");
  });

  it("acusa a recorrência e aponta a próxima data — caso ACORDAR seg–sex num sábado", () => {
    const d = diagnosticarTemplate({
      template: template({
        horaInicio: "04:30",
        horaFim: "04:35",
        rrule: JSON.stringify({ freq: "weekly", byday: [1, 2, 3, 4, 5] }),
      }),
      planoId: PLANO_A,
      planoDoDiaId: PLANO_A,
      planos: PLANOS,
      dia: SABADO,
    });
    expect(d.apareceHoje).toBe(false);
    expect(d.motivo).toBe("recorrencia");
    // próxima ocorrência é a segunda-feira seguinte, 2026-08-03
    expect(d.proximaOcorrencia && dayKeySP(d.proximaOcorrencia)).toBe("2026-08-03");
  });

  it("recorrência vence o plano quando os dois estão errados", () => {
    const d = diagnosticarTemplate({
      template: template({ rrule: JSON.stringify({ freq: "weekly", byday: [1] }) }),
      planoId: PLANO_A,
      planoDoDiaId: PLANO_B,
      planos: PLANOS,
      dia: SABADO,
    });
    expect(d.motivo).toBe("recorrencia");
  });

  it("sem próxima ocorrência quando a recorrência já terminou", () => {
    const d = diagnosticarTemplate({
      template: template({
        rrule: JSON.stringify({ freq: "daily", until: "2026-07-15T23:59:59-03:00" }),
      }),
      planoId: null,
      planoDoDiaId: null,
      planos: PLANOS,
      dia: SABADO,
    });
    expect(d.apareceHoje).toBe(false);
    expect(d.motivo).toBe("recorrencia");
    expect(d.proximaOcorrencia).toBeNull();
  });

  it('"não fazer hoje" (exdates) conta como não cair no dia', () => {
    const d = diagnosticarTemplate({
      template: template({
        rrule: JSON.stringify({ freq: "daily" }),
        exdates: JSON.stringify(["2026-08-01"]),
      }),
      planoId: null,
      planoDoDiaId: null,
      planos: PLANOS,
      dia: SABADO,
    });
    expect(d.apareceHoje).toBe(false);
    expect(d.motivo).toBe("recorrencia");
    expect(d.proximaOcorrencia && dayKeySP(d.proximaOcorrencia)).toBe("2026-08-02");
  });
});
