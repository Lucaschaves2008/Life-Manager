import { describe, expect, it } from "vitest";
import { contaNosTotaisDeFluxo } from "./financas-calc";

describe("contaNosTotaisDeFluxo (regressão: compromisso vazando pros totais de gasto)", () => {
  it("receita sempre conta", () => {
    expect(contaNosTotaisDeFluxo({ tipo: "receita", natureza: "despesa" })).toBe(true);
  });

  it("despesa comum conta", () => {
    expect(contaNosTotaisDeFluxo({ tipo: "despesa", natureza: "despesa" })).toBe(true);
  });

  it("despesa do tipo compromisso NÃO conta nos totais de gasto", () => {
    expect(contaNosTotaisDeFluxo({ tipo: "despesa", natureza: "compromisso" })).toBe(false);
  });

  it("transferência não conta (nem receita nem despesa)", () => {
    expect(contaNosTotaisDeFluxo({ tipo: "transferencia", natureza: "despesa" })).toBe(false);
  });
});
