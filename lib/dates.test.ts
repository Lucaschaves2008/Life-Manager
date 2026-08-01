import { describe, expect, it } from "vitest";
import {
  dayKeySP,
  fmtSP,
  monthKeySP,
  quarterKeySP,
  refDaSemanaSP,
  refDoAnoSP,
  refDoDiaSP,
  refDoMesSP,
  refDoSemestreSP,
  refDoTrimestreSP,
  semesterKeySP,
  spEndOfDay,
  spStartOfDay,
  yearKeySP,
} from "@/lib/dates";

/**
 * Estes testes rodam com TZ=UTC (ver vitest.config.ts), que é o fuso das
 * functions na Vercel. Antes da correção, refDoDiaSP() fazia o parse da string
 * no fuso do sistema: no Mac (BRT) dava meia-noite de SP e passava; em UTC dava
 * meia-noite UTC — 21h do dia anterior em SP — e todo WHERE por dia procurava
 * um dia atrás. Era por isso que trocar de Plano A para Plano B funcionava no
 * localhost e não fazia nada no site.
 */
describe("refDoDiaSP", () => {
  it("devolve a meia-noite de São Paulo (03:00Z) independente do fuso do processo", () => {
    expect(refDoDiaSP("2026-08-01").toISOString()).toBe("2026-08-01T03:00:00.000Z");
  });

  it("bate com o instante que as actions gravam (meio-dia -03:00 truncado)", () => {
    // app/actions/rotinas.ts grava assim; a leitura precisa cair no mesmo ponto.
    const gravado = spStartOfDay(new Date("2026-08-01T12:00:00-03:00"));
    expect(spStartOfDay(refDoDiaSP("2026-08-01")).toISOString()).toBe(gravado.toISOString());
  });

  it("é o inverso exato de dayKeySP", () => {
    for (const key of ["2026-01-01", "2026-08-01", "2026-12-31", "2026-02-28"]) {
      expect(dayKeySP(refDoDiaSP(key))).toBe(key);
    }
  });

  it("cobre o dia inteiro sem vazar para o dia seguinte", () => {
    const ref = refDoDiaSP("2026-08-01");
    expect(spStartOfDay(ref).toISOString()).toBe("2026-08-01T03:00:00.000Z");
    expect(spEndOfDay(ref).toISOString()).toBe("2026-08-02T02:59:59.999Z");
  });
});

/**
 * refDoDiaSP não era a única com o parse de string no fuso do sistema: as
 * chaves de mês/trimestre/ano/semestre/semana usavam o mesmo padrão. Nas de
 * período longo o desvio de 3h costuma cair dentro do mesmo balde, mas em
 * refDaSemanaSP custa uma SEMANA inteira quando 4/jan cai num domingo.
 */
describe("demais chaves de período são o inverso da sua key (em UTC)", () => {
  it("refDoMesSP", () => {
    for (const key of ["2026-01", "2026-08", "2026-12"]) {
      expect(monthKeySP(refDoMesSP(key))).toBe(key);
    }
  });

  it("refDoTrimestreSP", () => {
    for (const key of ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"]) {
      expect(quarterKeySP(refDoTrimestreSP(key))).toBe(key);
    }
  });

  it("refDoAnoSP", () => {
    for (const key of ["2025", "2026"]) {
      expect(yearKeySP(refDoAnoSP(key))).toBe(key);
    }
  });

  it("refDoSemestreSP", () => {
    for (const key of ["2026-S1", "2026-S2"]) {
      expect(semesterKeySP(refDoSemestreSP(key))).toBe(key);
    }
  });

  // refDaSemanaSP devolve o DOMINGO de exibição da semana ISO pedida — não é
  // o inverso de weekKeySP (que usa semana ISO, começando na segunda). O que
  // o fuso quebrava aqui era a âncora: 4/jan/2026 é DOMINGO, então recuar 3h
  // levava ao sábado 3/jan e o spStartOfWeek devolvia a semana ANTERIOR
  // inteira (28/dez/2025) — uma semana de erro, não um dia.
  it("refDaSemanaSP ancora na semana certa mesmo com o processo em UTC", () => {
    expect(dayKeySP(refDaSemanaSP("2026-W01"))).toBe("2026-01-04");
    expect(dayKeySP(refDaSemanaSP("2026-W29"))).toBe("2026-07-19");
  });

  it("refDaSemanaSP sempre devolve meia-noite de um domingo em SP", () => {
    for (const key of ["2026-W01", "2026-W29", "2027-W01"]) {
      const inicio = refDaSemanaSP(key);
      expect(fmtSP(inicio, "EEEE HH:mm")).toBe("domingo 00:00");
    }
  });
});
