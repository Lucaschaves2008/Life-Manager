import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import type { NextConfig } from "next";

const { version } = createRequire(import.meta.url)("./package.json");

/**
 * Identidade do build, congelada no momento em que o bundle é gerado.
 *
 * Serve para responder "o que está no ar é o mesmo que eu tenho aqui?" sem
 * adivinhação: a tela de Configurações mostra versão + commit, então basta
 * comparar o commit do site com o `git rev-parse --short HEAD` local.
 * Na Vercel o SHA vem pronto na env; no dev perguntamos ao git.
 */
function commitDoBuild(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  }
  try {
    return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "desconhecido";
  }
}

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_APP_VERSAO: version,
    NEXT_PUBLIC_APP_COMMIT: commitDoBuild(),
    NEXT_PUBLIC_APP_BUILD: new Date().toISOString(),
    NEXT_PUBLIC_APP_AMBIENTE: process.env.VERCEL_ENV ?? "local",
  },
  experimental: {
    // Habilita a diretiva "use cache" (camada de dados cacheada por usuário
    // com invalidação por tag nas server actions).
    useCache: true,
  },
  cacheLife: {
    // Perfil de TODA leitura de dado que o usuário edita (lib/data/*).
    //
    // O caminho feliz continua sendo a invalidação por tag na server action:
    // gravou, o updateTag derruba a entrada e a próxima leitura já vem fresca.
    // Este perfil é a REDE DE SEGURANÇA para quando a invalidação não alcança
    // o cache que serviu a página — outra instância serverless na Vercel, ou
    // uma escrita feita em outro ambiente (localhost apontando pro mesmo
    // banco). Com o perfil "days" (revalidate 24h / expire 7d) essa falha
    // escondia dado real por até uma semana: hábito criado e checklist vazio.
    //
    // 30s de revalidate troca um custo de banco irrelevante (app pessoal,
    // poucos usuários) por um teto de defasagem que o usuário nem percebe.
    usuario: { stale: 0, revalidate: 30, expire: 300 },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
