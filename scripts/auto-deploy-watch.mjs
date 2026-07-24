#!/usr/bin/env node
// Observa o repo e, a cada mudança salva, faz commit + push automático.
// O Vercel (conectado ao GitHub) builda sozinho a partir daí.
import { watch } from "node:fs";
import { execSync, exec } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEBOUNCE_MS = 3000;

const IGNORE = [
  "node_modules",
  ".next",
  ".git",
  ".vercel",
  "scripts/auto-deploy-watch.mjs",
];

let timer = null;
let pending = false;

function shouldIgnore(filename) {
  if (!filename) return true;
  return IGNORE.some((p) => filename.startsWith(p) || filename.includes(`${path.sep}${p}${path.sep}`));
}

function hasChanges() {
  try {
    const out = execSync("git status --porcelain", { cwd: ROOT }).toString().trim();
    return out.length > 0;
  } catch {
    return false;
  }
}

function commitAndPush() {
  if (!hasChanges()) return;
  const stamp = new Date().toLocaleString("pt-BR");
  try {
    execSync("git add -A", { cwd: ROOT, stdio: "inherit" });
    execSync(`git commit -m "auto: atualização automática (${stamp})"`, {
      cwd: ROOT,
      stdio: "inherit",
    });
    console.log("[auto-deploy] enviando para o GitHub (dispara o build no Vercel)...");
    exec("git push", { cwd: ROOT }, (err, stdout, stderr) => {
      if (err) {
        console.error("[auto-deploy] falha ao dar push:", stderr || err.message);
        return;
      }
      console.log("[auto-deploy] push concluído. Vercel deve iniciar o build agora.");
    });
  } catch (err) {
    console.error("[auto-deploy] erro no commit:", err.message);
  }
}

function scheduleCommit() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(commitAndPush, DEBOUNCE_MS);
}

console.log(`[auto-deploy] observando ${ROOT} — qualquer alteração salva vira commit+push automático em ${DEBOUNCE_MS / 1000}s de inatividade.`);

watch(ROOT, { recursive: true }, (_event, filename) => {
  if (shouldIgnore(filename)) return;
  pending = true;
  scheduleCommit();
});

process.on("SIGINT", () => {
  if (pending) commitAndPush();
  process.exit(0);
});
