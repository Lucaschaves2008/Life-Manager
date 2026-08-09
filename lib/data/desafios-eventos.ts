import { db } from "@/lib/db";
import { monthKeySP, quarterKeySP, semesterKeySP, weekKeySP } from "@/lib/dates";

/**
 * Feed de atividade persistente do desafio: eventos automáticos (meta
 * concluída no período, streak batendo um marco, líder da semana) com reação
 * rápida de emoji. Puramente derivado do progresso já calculado em
 * desafios.ts — nunca criado pelo usuário diretamente. Módulo próprio pra
 * evitar import circular com desafios.ts (que chama as funções daqui).
 */

const MARCOS_STREAK = [7, 30, 90];

type MetaParaEventos = { id: string; titulo: string; pct: number; periodo: string };
type MembroParaEventos = {
  userId: string;
  nome: string | null;
  streak: number;
  pontosTotais: number;
  metasGrandes: MetaParaEventos[];
};

export type CandidatoEvento = {
  userId: string;
  tipo: "meta_concluida" | "streak" | "lidera_semana";
  metaId: string | null;
  chave: string;
  texto: string;
};

function nomeOu(nome: string | null, fallback: string): string {
  return nome?.trim() || fallback;
}

/** Chave do período ATUAL (não o tipo) — é o que faz uma meta completada de
 * novo no período seguinte virar um evento novo em vez de ser descartada
 * pela idempotência. */
function chavePeriodoAtual(periodo: string, agora: Date): string {
  if (periodo === "semana") return weekKeySP(agora);
  if (periodo === "mes") return monthKeySP(agora);
  if (periodo === "trimestre") return quarterKeySP(agora);
  return semesterKeySP(agora);
}

/** Candidatos a evento novo — puro, sem I/O. sincronizarEventos filtra os que já existem. */
export function gerarCandidatosEventos(
  membros: MembroParaEventos[],
  agora: Date
): CandidatoEvento[] {
  const candidatos: CandidatoEvento[] = [];

  for (const m of membros) {
    for (const meta of m.metasGrandes) {
      if (meta.pct >= 100) {
        candidatos.push({
          userId: m.userId,
          tipo: "meta_concluida",
          metaId: meta.id,
          chave: `${meta.id}:${chavePeriodoAtual(meta.periodo, agora)}`,
          texto: `${nomeOu(m.nome, "Alguém")} concluiu "${meta.titulo}" 🎯`,
        });
      }
    }
    for (const marco of MARCOS_STREAK) {
      if (m.streak >= marco) {
        candidatos.push({
          userId: m.userId,
          tipo: "streak",
          metaId: null,
          chave: `marco:${marco}`,
          texto: `${nomeOu(m.nome, "Alguém")} bateu ${marco} dias de streak 🔥`,
        });
      }
    }
  }

  // Líder da semana: só faz sentido comparando gente, e só quando alguém tem
  // pontos de fato (evita "líder" no desafio recém-criado com tudo zerado).
  if (membros.length > 1) {
    const maiorPontuacao = Math.max(...membros.map((m) => m.pontosTotais));
    if (maiorPontuacao > 0) {
      const semana = chavePeriodoAtual("semana", agora);
      for (const lider of membros.filter((m) => m.pontosTotais === maiorPontuacao)) {
        candidatos.push({
          userId: lider.userId,
          tipo: "lidera_semana",
          metaId: null,
          chave: `semana:${semana}`,
          texto: `${nomeOu(lider.nome, "Alguém")} lidera o desafio essa semana 🏆`,
        });
      }
    }
  }

  return candidatos;
}

/** Insere os candidatos que ainda não existem — idempotente via unique(desafioId,userId,tipo,chave). */
export async function sincronizarEventos(
  desafioId: string,
  candidatos: CandidatoEvento[]
): Promise<void> {
  await db.desafioEvento.createMany({
    data: candidatos.map((c) => ({
      desafioId,
      userId: c.userId,
      tipo: c.tipo,
      metaId: c.metaId,
      chave: c.chave,
      texto: c.texto,
    })),
    skipDuplicates: true,
  });
}

export type DesafioEventoView = {
  id: string;
  tipo: "meta_concluida" | "streak" | "lidera_semana";
  texto: string;
  criadoEm: string;
  userId: string;
  nome: string | null;
  avatarUrl: string | null;
  reacoes: { emoji: string; count: number; reagiuEu: boolean }[];
};

const LIMITE_EVENTOS = 20;

export async function eventosDoDesafio(
  desafioId: string,
  viewerUserId: string,
  perfilPorId: Map<string, { nome: string | null; avatarUrl: string | null }>
): Promise<DesafioEventoView[]> {
  const eventos = await db.desafioEvento.findMany({
    where: { desafioId },
    orderBy: { data: "desc" },
    take: LIMITE_EVENTOS,
    include: { reacoes: true },
  });

  return eventos.map((e) => {
    const porEmoji = new Map<string, { count: number; reagiuEu: boolean }>();
    for (const r of e.reacoes) {
      const atual = porEmoji.get(r.emoji) ?? { count: 0, reagiuEu: false };
      atual.count++;
      if (r.userId === viewerUserId) atual.reagiuEu = true;
      porEmoji.set(r.emoji, atual);
    }
    return {
      id: e.id,
      tipo: e.tipo as DesafioEventoView["tipo"],
      texto: e.texto,
      criadoEm: e.data.toISOString(),
      userId: e.userId,
      nome: perfilPorId.get(e.userId)?.nome ?? null,
      avatarUrl: perfilPorId.get(e.userId)?.avatarUrl ?? null,
      reacoes: Array.from(porEmoji.entries()).map(([emoji, v]) => ({ emoji, ...v })),
    };
  });
}

export const EMOJIS_REACAO = ["🔥", "👏", "💪", "🎉", "😮"];

/** Reagir de novo (com o mesmo emoji ou outro) atualiza a reação anterior — 1 por pessoa por evento. */
export async function reagirEvento(
  eventoId: string,
  userId: string,
  emoji: string
): Promise<void> {
  if (!EMOJIS_REACAO.includes(emoji)) throw new Error("Emoji não permitido.");
  await db.desafioEventoReacao.upsert({
    where: { eventoId_userId: { eventoId, userId } },
    update: { emoji },
    create: { eventoId, userId, emoji },
  });
}

/** Remove a reação do usuário — clicar de novo no mesmo emoji desfaz. */
export async function removerReacaoEvento(eventoId: string, userId: string): Promise<void> {
  await db.desafioEventoReacao.deleteMany({ where: { eventoId, userId } });
}
