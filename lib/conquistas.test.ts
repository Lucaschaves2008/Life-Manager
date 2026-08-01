import { describe, expect, it } from "vitest";
import {
  MARCOS_STREAK,
  conquistaChecklistCompleto,
  feedbackHabilitado,
  marcoDeStreakAtingido,
} from "./conquistas";

describe("marcoDeStreakAtingido", () => {
  it("comemora ao cruzar o marco de 7 dias", () => {
    expect(marcoDeStreakAtingido(6, 7)).toBe(7);
  });

  it("não comemora enquanto o streak apenas se mantém acima do marco", () => {
    expect(marcoDeStreakAtingido(7, 8)).toBeNull();
    expect(marcoDeStreakAtingido(40, 41)).toBeNull();
  });

  it("não comemora quando o streak cai ou fica igual", () => {
    expect(marcoDeStreakAtingido(10, 10)).toBeNull();
    expect(marcoDeStreakAtingido(30, 2)).toBeNull();
  });

  it("pega o maior marco quando o salto cruza mais de um", () => {
    // ex.: importação de histórico levando 0 -> 120 de uma vez
    expect(marcoDeStreakAtingido(0, 120)).toBe(100);
  });

  it("cobre todos os marcos declarados", () => {
    for (const m of MARCOS_STREAK) {
      expect(marcoDeStreakAtingido(m - 1, m)).toBe(m);
    }
  });
});

describe("conquistaChecklistCompleto", () => {
  it("usa singular quando há um item só", () => {
    expect(conquistaChecklistCompleto("2026-07-31", 1).detalhe).toContain("único item");
  });

  it("usa plural com a contagem quando há vários", () => {
    expect(conquistaChecklistCompleto("2026-07-31", 5).detalhe).toContain("os 5 itens");
  });

  it("gera chave estável por dia (não repete a comemoração)", () => {
    const a = conquistaChecklistCompleto("2026-07-31", 3);
    const b = conquistaChecklistCompleto("2026-07-31", 3);
    expect(a.chave).toBe(b.chave);
    expect(conquistaChecklistCompleto("2026-08-01", 3).chave).not.toBe(a.chave);
  });
});

describe("feedbackHabilitado", () => {
  it("vem ligado por padrão (sem preferência salva)", () => {
    expect(feedbackHabilitado(undefined)).toBe(true);
    expect(feedbackHabilitado(null)).toBe(true);
  });

  it("desliga só com o valor explícito 'off'", () => {
    expect(feedbackHabilitado("off")).toBe(false);
    expect(feedbackHabilitado("on")).toBe(true);
  });
});
