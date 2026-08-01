import { describe, expect, it } from "vitest";
import { erroCoerenciaMacros, kcalEstimada } from "./dieta-calc";

describe("kcalEstimada", () => {
  it("aplica a regra de Atwater (4/4/9)", () => {
    expect(kcalEstimada({ prot: 25, carb: 30, gord: 10 })).toBe(25 * 4 + 30 * 4 + 10 * 9);
  });
});

describe("erroCoerenciaMacros", () => {
  it("aceita uma entrada real coerente (peito de frango, 100g)", () => {
    // ~31g prot, 0g carb, 3.6g gord ≈ 165 kcal
    expect(erroCoerenciaMacros({ kcal: 165, prot: 31, carb: 0, gord: 3.6 })).toBeNull();
  });

  it("rejeita o caso do bug relatado: 322g prot + 323g gordura numa entrada de 321 kcal", () => {
    const erro = erroCoerenciaMacros({ kcal: 321, prot: 322, carb: 0, gord: 323 });
    expect(erro).not.toBeNull();
  });

  it("aceita pequena variação por arredondamento de embalagem", () => {
    // 10 prot + 20 carb + 5 gord = 40+80+45 = 165 estimado; rótulo arredondou p/ 170
    expect(erroCoerenciaMacros({ kcal: 170, prot: 10, carb: 20, gord: 5 })).toBeNull();
  });

  it("rejeita valores negativos", () => {
    expect(erroCoerenciaMacros({ kcal: 100, prot: -5, carb: 0, gord: 0 })).not.toBeNull();
  });

  it("usa piso absoluto de tolerância para entradas pequenas", () => {
    // estimado = 0, tolerância 15% de 0 seria 0 — piso garante alguma folga
    expect(erroCoerenciaMacros({ kcal: 15, prot: 0, carb: 0, gord: 0 })).toBeNull();
  });
});
