import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Roda o guardião de verdade contra pastas de exemplo: se alguém quebrar o
// parser dele, ele passaria a aprovar tudo em silêncio — este teste pega.
function checar(pasta: string) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "checar-seguranca.mjs")], {
    env: { ...process.env, CHECAR_ROOT: path.join(__dirname, "__fixtures__", pasta) },
    encoding: "utf8",
  });
  return { codigo: r.status, saida: r.stdout + r.stderr };
}

describe("checar-seguranca", () => {
  it("barra action sem login, userId do cliente e mass assignment", () => {
    const { codigo, saida } = checar("inseguro");
    expect(codigo).toBe(1);
    expect(saida).toContain("semLogin() é server action sem requireUser");
    expect(saida).toContain('recebeUserId() é server action e recebe "userId"');
    expect(saida).toContain("grava o objeto do cliente inteiro");
  });

  it("aprova action com login e campos explícitos", () => {
    const { codigo, saida } = checar("seguro");
    expect(saida).toContain("checar-seguranca: ok");
    expect(codigo).toBe(0);
  });
});
