import { describe, expect, it } from "vitest";
import {
  MOEDAS,
  PADRAO,
  UNIDADES_PESO,
  chaveNotificacao,
  lerOpcao,
  notificacaoAtiva,
} from "./preferencias";

describe("lerOpcao", () => {
  it("devolve o valor salvo quando é uma opção válida", () => {
    expect(lerOpcao("USD", MOEDAS, PADRAO.moeda)).toBe("USD");
  });

  it("cai no padrão quando não há valor salvo", () => {
    expect(lerOpcao(undefined, MOEDAS, PADRAO.moeda)).toBe("BRL");
    expect(lerOpcao(null, MOEDAS, PADRAO.moeda)).toBe("BRL");
  });

  it("cai no padrão quando o valor salvo é lixo (setting corrompida)", () => {
    expect(lerOpcao("ienes", MOEDAS, PADRAO.moeda)).toBe("BRL");
    expect(lerOpcao("", UNIDADES_PESO, PADRAO.peso)).toBe("kg");
  });
});

describe("chaveNotificacao", () => {
  it("monta a chave por tipo e canal", () => {
    expect(chaveNotificacao("streak_risco", "email")).toBe("notif_streak_risco_email");
    expect(chaveNotificacao("streak_risco", "push")).toBe("notif_streak_risco_push");
  });

  it("gera chaves distintas por canal (não sobrescreve uma com a outra)", () => {
    expect(chaveNotificacao("conta_a_vencer", "email")).not.toBe(
      chaveNotificacao("conta_a_vencer", "push")
    );
  });
});

describe("notificacaoAtiva", () => {
  it("vem desligada por padrão — nada é enviado sem opt-in explícito", () => {
    expect(notificacaoAtiva(undefined)).toBe(false);
    expect(notificacaoAtiva(null)).toBe(false);
    expect(notificacaoAtiva("off")).toBe(false);
  });

  it("liga só com 'on'", () => {
    expect(notificacaoAtiva("on")).toBe(true);
  });
});
