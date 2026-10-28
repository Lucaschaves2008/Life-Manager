import { describe, expect, it } from "vitest";
import { apenas } from "@/lib/utils";

describe("apenas", () => {
  type In = { nome: string; valor?: number | null };

  it("descarta chaves que o cliente injetou", () => {
    const hostil = { nome: "x", valor: 10, userId: "vitima", contaFinanceiraId: "c" } as In;
    expect(apenas(hostil, { nome: true, valor: true })).toEqual({ nome: "x", valor: 10 });
  });

  it("não inventa chave opcional ausente", () => {
    expect(Object.keys(apenas({ nome: "x" } as In, { nome: true, valor: true }))).toEqual(["nome"]);
  });
});
