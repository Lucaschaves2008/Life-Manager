import "server-only";
import { db } from "@/lib/db";
import { dayKeySP } from "@/lib/dates";
import {
  PREF_CONQUISTAS,
  conquistaChecklistCompleto,
  conquistaDietaCompleta,
  conquistaMetaBatida,
  conquistaStreakMarco,
  feedbackHabilitado,
  marcoDeStreakAtingido,
  type Conquista,
} from "@/lib/conquistas";
import { metasQuantitativas } from "@/lib/data/metas-quantitativas";
import { rotinasDoDia } from "@/lib/data/rotinas";
import { diaDaDieta } from "@/lib/data/dieta";
import { streakLC } from "@/lib/data/home";

/**
 * Detecta o que há para comemorar AGORA, comparando o estado atual com o que
 * já foi comemorado (Setting "conquistas_vistas", uma lista de chaves).
 *
 * Deliberadamente NÃO é cacheado com "use cache": depende do que o usuário já
 * viu, e precisa refletir a escrita da mesma request (marcar o último item do
 * checklist tem que comemorar na volta daquela action).
 *
 * A gravação de "visto" acontece aqui mesmo, na leitura: assim a comemoração
 * dispara uma vez só, mesmo que o usuário recarregue a página em seguida.
 */
export async function conquistasPendentes(
  userId: string,
  agora: Date
): Promise<{ conquistas: Conquista[]; habilitado: boolean }> {
  const dia = dayKeySP(agora);

  const [prefRow, vistasRow] = await Promise.all([
    db.setting.findUnique({
      where: { userId_key: { userId, key: PREF_CONQUISTAS } },
    }),
    db.setting.findUnique({
      where: { userId_key: { userId, key: chaveVistas(dia) } },
    }),
  ]);

  const habilitado = feedbackHabilitado(prefRow?.value);
  if (!habilitado) return { conquistas: [], habilitado };

  const vistas = new Set<string>(parseVistas(vistasRow?.value));
  const candidatas = await detectar(userId, agora, dia);
  const novas = candidatas.filter((c) => !vistas.has(c.chave));

  if (novas.length > 0) {
    const proximas = [...vistas, ...novas.map((c) => c.chave)];
    await db.setting.upsert({
      where: { userId_key: { userId, key: chaveVistas(dia) } },
      update: { value: JSON.stringify(proximas) },
      create: { userId, key: chaveVistas(dia), value: JSON.stringify(proximas) },
    });
  }

  return { conquistas: novas, habilitado };
}

/** Uma linha por dia — evita a lista crescer para sempre. */
function chaveVistas(dia: string): string {
  return `conquistas_vistas:${dia}`;
}

function parseVistas(valor: string | undefined): string[] {
  if (!valor) return [];
  try {
    const v = JSON.parse(valor);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function detectar(
  userId: string,
  agora: Date,
  dia: string
): Promise<Conquista[]> {
  const [metas, ocorrencias, dieta, streak] = await Promise.all([
    metasQuantitativas(userId, agora).catch(() => []),
    rotinasDoDia(userId, agora).catch(() => []),
    diaDaDieta(userId, agora).catch(() => null),
    streakLC(userId, agora).catch(() => null),
  ]);

  const out: Conquista[] = [];

  // 1. Metas quantitativas que chegaram a 100%
  for (const m of metas) {
    if (m.pct >= 100) out.push(conquistaMetaBatida(m.id, m.titulo, dia));
  }

  // 2. Checklist do dia 100% (só conta se havia algo a fazer)
  if (ocorrencias.length > 0 && ocorrencias.every((o) => o.feito)) {
    out.push(conquistaChecklistCompleto(dia, ocorrencias.length));
  }

  // 3. Dieta: todas as refeições do plano cumpridas
  if (dieta && dieta.refeicoes.length > 0) {
    const todas = dieta.refeicoes.every((r) => dieta.cumpridas.includes(r.id));
    if (todas) out.push(conquistaDietaCompleta(dia));
  }

  // 4. Streak cruzando um marco (7/30/100/365)
  if (streak) {
    const marco = marcoDeStreakAtingido(streak.streak - 1, streak.streak);
    if (marco) out.push(conquistaStreakMarco(marco, dia));
  }

  return out;
}
