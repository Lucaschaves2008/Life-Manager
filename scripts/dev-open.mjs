#!/usr/bin/env node
// Sobe o Next dev server e abre o navegador automaticamente assim que estiver pronto.
import { spawn } from "node:child_process";

const PORT = process.env.PORT || "3000";
const URL = `http://localhost:${PORT}`;

const next = spawn("npx", ["next", "dev", "--turbopack", "-p", PORT], {
  stdio: ["inherit", "pipe", "inherit"],
  shell: false,
});

let opened = false;

next.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  if (!opened && /Ready in|compiled|Local:/i.test(text)) {
    opened = true;
    const opener =
      process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    spawn(opener, [URL], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref();
    console.log(`[dev-open] abrindo ${URL} no navegador...`);
  }
});

next.on("exit", (code) => process.exit(code ?? 0));

process.on("SIGINT", () => {
  next.kill("SIGINT");
  process.exit(0);
});
