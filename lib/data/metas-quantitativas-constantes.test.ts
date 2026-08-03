import { describe, expect, it } from "vitest";
import {
  METRICAS,
  REGISTROS_VAZIOS,
  calcularMetrica,
  contarCardio,
} from "./metas-quantitativas-constantes";

const vazio = REGISTROS_VAZIOS;

describe("calcularMetrica (fonte única — metas quantitativas + desafios)", () => {
  it("treinos soma musculação e as três modalidades de cardio", () => {
    expect(
      calcularMetrica("treinos", {
        ...vazio,
        treinos: 8,
        corridas: 3,
        natacoes: 2,
        pedaladas: 1,
      })
    ).toBe(14);
  });

  it("corridas_completas conta só corridas, sem musculação", () => {
    expect(calcularMetrica("corridas_completas", { ...vazio, treinos: 8, corridas: 3 })).toBe(3);
  });

  it("km_corridos devolve a soma de km, sem contar as outras modalidades", () => {
    expect(
      calcularMetrica("km_corridos", { ...vazio, km: 28.2, kmNatacao: 2, kmCiclismo: 40 })
    ).toBeCloseTo(28.2);
  });

  it("metros_nadados converte os km armazenados em metros", () => {
    expect(calcularMetrica("metros_nadados", { ...vazio, kmNatacao: 1.5 })).toBe(1500);
  });

  it("km_pedalados devolve só a distância de ciclismo", () => {
    expect(
      calcularMetrica("km_pedalados", { ...vazio, km: 28.2, kmCiclismo: 40 })
    ).toBeCloseTo(40);
  });

  it("natacoes_completas e pedaladas_completas contam só a própria modalidade", () => {
    const registros = { ...vazio, corridas: 3, natacoes: 2, pedaladas: 1 };
    expect(calcularMetrica("natacoes_completas", registros)).toBe(2);
    expect(calcularMetrica("pedaladas_completas", registros)).toBe(1);
  });

  it("contarCardio bucketiza por modalidade e trata linha antiga como corrida", () => {
    expect(
      contarCardio([
        { modalidade: "corrida" },
        { modalidade: "natacao" },
        { modalidade: "ciclismo" },
        { modalidade: "" },
      ])
    ).toEqual({ corridas: 2, natacoes: 1, pedaladas: 1 });
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
