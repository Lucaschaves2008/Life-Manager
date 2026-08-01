import { describe, expect, it } from "vitest";
import { campoCSV, nomeArquivo, paraCSV } from "./exportar";

describe("campoCSV", () => {
  it("passa valores simples sem envelopar", () => {
    expect(campoCSV("treino")).toBe("treino");
    expect(campoCSV(42)).toBe("42");
  });

  it("envelopa e dobra aspas — descrição com aspas não quebra a coluna", () => {
    expect(campoCSV('Almoço "reforçado"')).toBe('"Almoço ""reforçado"""');
  });

  it("envelopa quando há vírgula ou ponto e vírgula (separadores)", () => {
    expect(campoCSV("Mercado, feira")).toBe('"Mercado, feira"');
    expect(campoCSV("a;b")).toBe('"a;b"');
  });

  it("envelopa quebras de linha (nota multilinha não vira duas linhas)", () => {
    expect(campoCSV("linha 1\nlinha 2")).toBe('"linha 1\nlinha 2"');
  });

  it("vazio para null/undefined, não a string 'null'", () => {
    expect(campoCSV(null)).toBe("");
    expect(campoCSV(undefined)).toBe("");
  });

  it("datas saem em ISO", () => {
    expect(campoCSV(new Date("2026-07-31T12:00:00Z"))).toBe("2026-07-31T12:00:00.000Z");
  });
});

describe("paraCSV", () => {
  it("gera cabeçalho e linhas na ordem das colunas", () => {
    const csv = paraCSV(
      [
        { data: "2026-07-31", valor: 1000, descricao: "Mercado" },
        { data: "2026-07-30", valor: 250, descricao: "Uber" },
      ],
      ["data", "valor", "descricao"]
    );
    expect(csv).toBe("data,valor,descricao\n2026-07-31,1000,Mercado\n2026-07-30,250,Uber");
  });

  it("mantém só o cabeçalho quando não há linhas", () => {
    expect(paraCSV([], ["data", "valor"])).toBe("data,valor");
  });

  it("infere colunas do primeiro item quando não são declaradas", () => {
    expect(paraCSV([{ a: 1, b: 2 }])).toBe("a,b\n1,2");
  });

  it("preserva a integridade com campo contendo o separador", () => {
    const csv = paraCSV([{ descricao: "Padaria, centro", valor: 15 }], ["descricao", "valor"]);
    expect(csv.split("\n")[1]).toBe('"Padaria, centro",15');
  });
});

describe("nomeArquivo", () => {
  it("monta nome previsível", () => {
    expect(nomeArquivo("transacoes", "2026-07-31", "csv")).toBe(
      "mylife-transacoes-2026-07-31.csv"
    );
  });

  it("higieniza o nome do conjunto", () => {
    expect(nomeArquivo("Dados Completos", "2026-07-31", "json")).toBe(
      "mylife-dados-completos-2026-07-31.json"
    );
  });
});
