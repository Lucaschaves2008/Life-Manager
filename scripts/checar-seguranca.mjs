#!/usr/bin/env node
// Guardião de segurança. Roda no `prebuild` (deploy na Vercel falha se algo
// aqui quebrar), no auto-deploy-watch antes de cada commit e no GitHub Actions.
//
// O repositório é PÚBLICO: o que entra no git está exposto para sempre.
// Regras (ver SECURITY.md):
//   1. Todo export de arquivo "use server" é um endpoint HTTP público —
//      precisa chamar requireUser/requireSuperAdmin/getCurrentUser.
//   2. Export de "use server" não recebe userId do cliente — o usuário vem
//      SEMPRE da sessão. Funções que recebem userId moram em lib/ (server-only).
//   3. Nenhum segredo em arquivo versionável.
//   4. Nada de NEXT_PUBLIC_ com cara de segredo (vai pro bundle do navegador).
//   5. Client component não importa módulo de servidor (db, admin, rate-limit).
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const erros = [];
const erro = (arquivo, msg) => erros.push(`  ✗ ${arquivo}: ${msg}`);

/** Arquivos que poderiam ser commitados: versionados + novos não ignorados. */
function arquivosVersionaveis() {
  try {
    const out = execSync("git ls-files --cached --others --exclude-standard -z", {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    }).toString();
    const lista = [...new Set(out.split("\0").filter(Boolean))];
    if (lista.length > 0) return lista.filter((f) => fs.existsSync(path.join(ROOT, f)));
  } catch {
    // sem git (ex.: build da Vercel) — cai no walk abaixo
  }
  const IGNORAR = new Set(["node_modules", ".next", ".git", ".vercel", "coverage"]);
  const lista = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (IGNORAR.has(e.name)) continue;
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) walk(rel);
      else if (!/^\.env/.test(e.name) || e.name === ".env.example") lista.push(rel);
    }
  };
  walk("");
  return lista;
}

const arquivos = arquivosVersionaveis();
const ehCodigo = (f) => /\.(m?[jt]sx?)$/.test(f) && !f.startsWith("node_modules/");
const ler = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// ---------- 1 e 2: server actions ----------
// Exports públicos de propósito (fluxo de login/cadastro, sem sessão ainda).
const SEM_SESSAO_PERMITIDO = new Set([
  "app/actions/auth.ts:signUp",
  "app/actions/auth.ts:signIn",
  "app/actions/auth.ts:signOut",
]);
const GUARDA = /\b(requireUser|requireSuperAdmin|getCurrentUser)\s*\(/;

for (const f of arquivos.filter(ehCodigo)) {
  const src = ler(f);
  if (!/^\s*["']use server["']/m.test(src.slice(0, 500))) continue;

  // fatia o arquivo em blocos que começam em declarações de topo
  const blocos = src.split(/\n(?=(?:export\s+)?(?:async\s+)?function\s|export\s+const\s|const\s|type\s|export\s+type\s|\/\*\*)/);
  for (const bloco of blocos) {
    const m = bloco.match(/^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/s);
    const mConst = bloco.match(/^export\s+const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(([^)]*)\)/s);
    const achado = m ?? mConst;
    if (!achado) continue;
    const [, nome, params] = achado;
    const id = `${f}:${nome}`;

    if (/^\s*(userId|uid)\b/.test(params)) {
      erro(f, `${nome}() é server action e recebe "userId" do cliente — mova para lib/ (server-only) e pegue o usuário da sessão.`);
    }
    if (!SEM_SESSAO_PERMITIDO.has(id) && !GUARDA.test(bloco)) {
      erro(f, `${nome}() é server action sem requireUser()/requireSuperAdmin() — qualquer pessoa na internet pode chamá-la.`);
    }
  }
}

// ---------- 3: segredos ----------
const PADROES_SEGREDO = [
  [/sb_secret_[A-Za-z0-9_-]{10,}/, "chave secreta do Supabase"],
  [/eyJhbGciOi[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, "JWT (service_role/anon antigo?)"],
  [/postgres(?:ql)?:\/\/[^\s"'<>:]+:[^\s"'<>@]{6,}@[^\s"'<>]+/, "connection string com senha"],
  [/-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/, "chave privada"],
  [/GOCSPX-[A-Za-z0-9_-]{10,}/, "Google client secret"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
  [/gh[pousr]_[A-Za-z0-9]{30,}/, "token do GitHub"],
  [/sk_live_[A-Za-z0-9]{10,}/, "chave Stripe live"],
];
const BINARIO = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|db|lock)$/i;

for (const f of arquivos) {
  const base = path.basename(f);
  if (/^\.env/.test(base) && base !== ".env.example") {
    erro(f, "arquivo .env versionável — deve estar no .gitignore.");
    continue;
  }
  if (/\.(pem|key|p12|pfx|dump|backup|bak)$/i.test(base) || /^(credenciais|credentials|secrets?)\b/i.test(base)) {
    erro(f, "arquivo com cara de credencial/backup — não pode ir para o repositório público.");
    continue;
  }
  if (BINARIO.test(f) || f === "package-lock.json" || f.startsWith("node_modules/")) continue;
  let src;
  try {
    src = ler(f);
  } catch {
    continue;
  }
  if (src.length > 2_000_000) continue;
  for (const [re, nome] of PADROES_SEGREDO) {
    if (re.test(src)) erro(f, `possível ${nome} no conteúdo.`);
  }
}

// ---------- 4 e 5: fronteira cliente/servidor ----------
const MODULOS_SERVIDOR = /from\s+["'](@\/lib\/db|@\/lib\/supabase\/admin|@\/lib\/supabase\/storage|@\/lib\/rate-limit|@\/lib\/auth)["']/;
for (const f of arquivos.filter(ehCodigo)) {
  const src = ler(f);
  for (const m of src.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
    if (/SECRET|SERVICE|PASSWORD|SENHA|PRIVATE|TOKEN/.test(m[0])) {
      erro(f, `${m[0]} vai para o bundle do navegador — segredo nunca leva o prefixo NEXT_PUBLIC_.`);
    }
  }
  if (/^\s*["']use client["']/m.test(src.slice(0, 300))) {
    const imp = src.match(MODULOS_SERVIDOR);
    if (imp && !new RegExp(`import\\s+type[^;]*${imp[1].replace(/[/@]/g, "\\$&")}`).test(src)) {
      erro(f, `client component importando ${imp[1]} (módulo de servidor).`);
    }
  }
}

if (erros.length > 0) {
  console.error(`\n🔒 checar-seguranca: ${erros.length} problema(s)\n${erros.join("\n")}\n`);
  console.error("Regras em SECURITY.md. Corrija antes de commitar/deployar.\n");
  process.exit(1);
}
console.log(`🔒 checar-seguranca: ok (${arquivos.length} arquivos verificados)`);
