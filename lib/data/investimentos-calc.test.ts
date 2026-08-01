import { describe, expect, it } from "vitest";
import { aportadoEm, dividendosEm, valorEm, type Movimento } from "./investimentos-calc";

function mov(tipo: string, valor: number, diaISO: string): Movimento {
  return { id: diaISO + tipo + valor, tipo, valor, data: new Date(diaISO), nota: null };
}

describe("valorEm", () => {
  it("soma aportes e dividendos, subtrai resgates", () => {
    const movs = [
      mov("aporte", 10_000_00, "2026-01-01"),
      mov("dividendo", 50_00, "2026-02-01"),
      mov("resgate", 2_000_00, "2026-03-01"),
    ];
    expect(valorEm(movs, new Date("2026-12-31"))).toBe(10_000_00 + 50_00 - 2_000_00);
  });

  it("atualizacao substitui o valor acumulado, não soma", () => {
    const movs = [
      mov("aporte", 10_000_00, "2026-01-01"),
      mov("atualizacao", 12_657_82, "2026-06-01"),
    ];
    expect(valorEm(movs, new Date("2026-12-31"))).toBe(12_657_82);
  });

  it("ignora movimentos após a data de corte", () => {
    const movs = [mov("aporte", 1_000_00, "2026-06-01"), mov("aporte", 5_000_00, "2026-08-01")];
    expect(valorEm(movs, new Date("2026-07-01"))).toBe(1_000_00);
  });

  it("nunca retorna negativo", () => {
    const movs = [mov("aporte", 100, "2026-01-01"), mov("resgate", 1_000, "2026-01-02")];
    expect(valorEm(movs, new Date("2026-12-31"))).toBe(0);
  });
});

describe("aportadoEm", () => {
  it("conta aportes menos resgates, sem incluir dividendo", () => {
    const movs = [
      mov("aporte", 10_000_00, "2026-01-01"),
      mov("dividendo", 500_00, "2026-02-01"),
      mov("resgate", 1_000_00, "2026-03-01"),
    ];
    expect(aportadoEm(movs, new Date("2026-12-31"))).toBe(9_000_00);
  });
});

describe("dividendosEm", () => {
  it("soma só os dividendos", () => {
    const movs = [mov("aporte", 1_000_00, "2026-01-01"), mov("dividendo", 30_00, "2026-02-01")];
    expect(dividendosEm(movs, new Date("2026-12-31"))).toBe(30_00);
  });
});

describe("patrimônio total = soma dos ativos (regressão do bug de card desatualizado)", () => {
  it("a soma de valorEm de cada ativo bate com o total esperado", () => {
    const ativos: Movimento[][] = [
      [mov("aporte", 12_657_82, "2026-01-01")],
      [mov("aporte", 1_000_00, "2026-01-01")],
      [mov("aporte", 5_000_00, "2026-01-01"), mov("resgate", 5_000_00, "2026-02-01")],
    ];
    const ate = new Date("2026-12-31");
    const patrimonio = ativos.reduce((soma, movs) => soma + valorEm(movs, ate), 0);
    expect(patrimonio).toBe(12_657_82 + 1_000_00 + 0);
  });
});
