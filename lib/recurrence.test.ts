import { describe, expect, it } from "vitest";
import { expandEvent } from "@/lib/recurrence";
import { dayKeySP, refDoDiaSP } from "@/lib/dates";

function evento(inicioISO: string, rrule: object) {
  const inicio = new Date(inicioISO);
  return {
    id: "e1",
    titulo: "Academia",
    inicio,
    fim: new Date(inicio.getTime() + 60 * 60 * 1000),
    diaInteiro: false,
    rrule: JSON.stringify(rrule),
    exdates: "[]",
  };
}

// semana de seg 26/10/2026 a dom 01/11/2026 (SP)
const de = refDoDiaSP("2026-10-26");
const ate = new Date(refDoDiaSP("2026-11-02").getTime() - 1);

describe("expandEvent — eventos antigos", () => {
  it("evento diário criado há mais de 2 anos continua aparecendo", () => {
    const ocs = expandEvent(evento("2023-01-02T10:00:00-03:00", { freq: "daily" }), de, ate);
    expect(ocs.map((o) => o.dayKey)).toEqual([
      "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01",
    ]);
    // mantém o horário original (10h em SP)
    expect(ocs[0].inicio.toISOString()).toBe("2026-10-26T13:00:00.000Z");
  });

  it("semanal com dias marcados (seg e qua) criado há anos", () => {
    const ocs = expandEvent(evento("2022-03-07T07:00:00-03:00", { freq: "weekly", byday: [1, 3] }), de, ate);
    expect(ocs.map((o) => o.dayKey)).toEqual(["2026-10-26", "2026-10-28"]);
  });

  it("diário a cada 2 dias mantém o alinhamento com o início", () => {
    const ocs = expandEvent(evento("2025-01-01T08:00:00-03:00", { freq: "daily", interval: 2 }), de, ate);
    const inicio = refDoDiaSP("2025-01-01").getTime();
    for (const o of ocs) {
      const dias = Math.round((refDoDiaSP(dayKeySP(o.inicio)).getTime() - inicio) / 86_400_000);
      expect(dias % 2).toBe(0);
    }
    expect(ocs.length).toBeGreaterThanOrEqual(3);
  });

  it("intervalo fracionário vindo do cliente não trava nem estoura", () => {
    const ocs = expandEvent(evento("2026-10-01T08:00:00-03:00", { freq: "daily", interval: 0.5 }), de, ate);
    expect(ocs).toHaveLength(7);
  });
});
