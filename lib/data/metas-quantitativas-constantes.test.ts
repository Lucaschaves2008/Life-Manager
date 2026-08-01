import { describe, expect, it } from "vitest";
import {
  METRICAS,
  calcularMetrica,
  type RegistrosDoPeriodo,
} from "./metas-quantitativas-constantes";

const vazio: RegistrosDoPeriodo = {
  treinos: 0,
  corridas: 0,
  km: 0,
  refeicoesCumpridas: 0,
  segundosEstudo: 0,
  dinheiroCentavos: 0,
};

describe("calcularMetrica (fonte única — metas quantitativas + desafios)", () => {
  it("treinos soma musculação e corridas", () => {
    expect(calcularMetrica("treinos", { ...vazio, treinos: 8, corridas: 3 })).toBe(11);
  });

  it("corridas_completas conta só corridas, sem musculação", () => {
    expect(calcularMetrica("corridas_completas", { ...vazio, treinos: 8, corridas: 3 })).toBe(3);
  });

  it("km_corridos devolve a soma de km", () => {
    expect(calcularMetrica("km_corridos", { ...vazio, km: 28.2 })).toBeCloseTo(28.2);
  });

  it("refeicoes_cumpridas devolve a contagem", () => {
    expect(calcularMetrica("refeicoes_cumpridas", { ...vazio, refeicoesCumpridas: 42 })).toBe(42);
  });

  it("horas_estudo converte segundos em horas", () => {
    expect(calcularMetrica("horas_estudo", { ...vazio, segundosEstudo: 5400 })).toBe(1.5);
  });

  it("dinheiro converte centavos em reais", () => {
    expect(calcularMetrica("dinheiro", { ...vazio, dinheiroCentavos: 150_000 })).toBe(1500);
  });

  it("cobre todas as métricas declaradas em METRICAS (nenhuma sem fórmula)", () => {
    for (const { value } of METRICAS) {
      expect(() => calcularMetrica(value, vazio)).not.toThrow();
      expect(calcularMetrica(value, vazio)).toBe(0);
    }
  });
});
