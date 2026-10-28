import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

const { ordemDeExclusao } = await import("@/lib/apagar-dados-usuario");
const { Prisma } = await import("@prisma/client");

describe("ordemDeExclusao", () => {
  const ordem = ordemDeExclusao();
  const antes = (filho: string, pai: string) =>
    expect(ordem.indexOf(filho), `${filho} antes de ${pai}`).toBeLessThan(ordem.indexOf(pai));

  it("cobre todo modelo com userId do schema real", () => {
    const comUserId = Prisma.dmmf.datamodel.models
      .filter((m) => m.fields.some((f) => f.name === "userId"))
      .map((m) => m.name);
    expect([...ordem].sort()).toEqual([...comUserId].sort());
  });

  it("apaga quem aponta antes de quem é apontado", () => {
    antes("Transaction", "Account");
    antes("Transaction", "ContaFinanceira");
    antes("SetLog", "WorkoutSession");
    antes("WorkoutSession", "Routine");
    antes("RecipeItem", "Food");
    antes("RotinaCheckDia", "RotinaTemplate");
    antes("RotinaTemplate", "StudyCategory");
  });

  it("toda FK entre modelos do usuário respeita a ordem", () => {
    const pos = new Map(ordem.map((n, i) => [n, i]));
    for (const m of Prisma.dmmf.datamodel.models) {
      if (!pos.has(m.name)) continue;
      for (const f of m.fields) {
        if (f.relationFromFields?.length && pos.has(f.type) && f.type !== m.name) {
          expect(pos.get(m.name)!, `${m.name} -> ${f.type}`).toBeLessThan(pos.get(f.type)!);
        }
      }
    }
  });
});
