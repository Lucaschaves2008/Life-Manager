import { describe, expect, it } from "vitest";
import { somarKmNoPeriodo } from "./treinos-format";

const corrida = (iso: string, km: number) => ({ data: new Date(iso), km });

describe("somarKmNoPeriodo", () => {
  const semana = { inicio: new Date("2026-07-26T00:00:00Z"), fim: new Date("2026-08-01T23:59:59Z") };

  it("soma só as corridas dentro da janela", () => {
    const corridas = [
      corrida("2026-07-25T10:00:00Z", 5), // antes
      corrida("2026-07-27T10:00:00Z", 10), // dentro
      corrida("2026-07-30T10:00:00Z", 8.2), // dentro
      corrida("2026-08-02T10:00:00Z", 21), // depois
    ];
    expect(somarKmNoPeriodo(corridas, semana.inicio, semana.fim)).toBeCloseTo(18.2);
  });

  it("inclui as corridas exatamente nas bordas do intervalo", () => {
    const corridas = [corrida("2026-07-26T00:00:00Z", 3), corrida("2026-08-01T23:59:59Z", 4)];
    expect(somarKmNoPeriodo(corridas, semana.inicio, semana.fim)).toBe(7);
  });

  it("devolve 0 sem corridas na janela", () => {
    expect(somarKmNoPeriodo([corrida("2026-01-01T10:00:00Z", 9)], semana.inicio, semana.fim)).toBe(0);
  });

  it("card-resumo e barra do gráfico dão o MESMO km para a semana atual (regressão de drift)", () => {
    const corridas = [
      corrida("2026-07-27T06:00:00Z", 6.5),
      corrida("2026-07-29T06:00:00Z", 12),
      corrida("2026-07-20T06:00:00Z", 30), // semana anterior — não pode entrar
    ];
    // resumoTreinos.kmSemana e a barra atual de volumeSemanal usam o mesmo
    // helper com o mesmo par (spStartOfWeek, spEndOfWeek) do dia de referência.
    const kmCardResumo = somarKmNoPeriodo(corridas, semana.inicio, semana.fim);
    const kmBarraAtual = somarKmNoPeriodo(corridas, semana.inicio, semana.fim);
    expect(kmCardResumo).toBe(kmBarraAtual);
    expect(kmCardResumo).toBeCloseTo(18.5);
  });
});
