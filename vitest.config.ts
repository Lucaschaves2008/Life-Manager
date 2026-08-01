import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    // A Vercel roda as functions em UTC; o Mac de dev roda em America/Sao_Paulo.
    // Rodar a suíte em UTC é o que faz um bug de fuso falhar AQUI em vez de só
    // em produção — foi assim que "o Plano B não muda no site" passou batido:
    // refDoDiaSP() caía um dia atrás fora de SP e nenhum teste percebia.
    env: { TZ: "UTC" },
  },
});
