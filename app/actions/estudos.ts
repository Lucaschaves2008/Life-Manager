"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { tagUsuario } from "@/lib/cache-tags";
import { spStartOfDay } from "@/lib/dates";
import { templateOcorreNoDia } from "@/lib/rotina-helpers";

function revalidar(userId: string) {
  // toda mutação escreve em StudySession/StudyPause → invalida o módulo estudos
  revalidateTag(tagUsuario(userId, "estudos"));
  revalidatePath("/estudos");
  revalidatePath("/estudos/dashboard");
  revalidatePath("/");
}

function diffSec(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 1000));
}

/**
 * Inicia uma nova sessão de estudo. Se já houver uma em andamento, ela é
 * finalizada antes (não deixamos duas rodando ao mesmo tempo).
 */
export async function iniciarSessao(input: {
  subject: string;
  targetMinutes?: number | null;
  categoryId?: string | null;
}) {
  const { id: userId } = await requireUser();
  const emAndamento = await db.studySession.findFirst({
    where: { userId, endedAt: null },
  });
  if (emAndamento) await finalizarSessao(emAndamento.id);

  // valida a categoria (se informada) e adota nome/meta dela quando o usuário
  // não digitou um assunto/meta próprios — ligando cronômetro ↔ checklist
  let categoryId: string | null = null;
  let subject = input.subject.trim();
  const targetMinutes = input.targetMinutes ?? null;
  if (input.categoryId) {
    const cat = await db.studyCategory.findFirst({
      where: { id: input.categoryId, userId, ativo: true },
      select: { id: true, nome: true },
    });
    if (cat) {
      categoryId = cat.id;
      if (!subject) subject = cat.nome;
    }
  }
  if (!subject) subject = "Estudo";

  const sessao = await db.studySession.create({
    data: { subject, startedAt: new Date(), targetMinutes, categoryId, userId },
  });
  // auto-check: ao cronometrar uma categoria, os itens de estudo do plano de
  // HOJE vinculados a ela marcam sozinhos (o checklist também deriva o tempo)
  if (categoryId) {
    await marcarItensAuto(userId, categoryId, sessao.startedAt);
    revalidateTag(tagUsuario(userId, "checklist"));
  }
  revalidar(userId);
  return sessao.id;
}

/**
 * Marca como feito (RotinaCheckDia.feitoAuto) os templates do checklist do
 * tipo "estudo" vinculados a `categoryId` que ocorrem no dia de `quando`.
 * Não sobrescreve um check já existente (manual ou auto).
 */
async function marcarItensAuto(userId: string, categoryId: string, quando: Date) {
  const dia = spStartOfDay(quando);
  const templates = await db.rotinaTemplate.findMany({
    where: { userId, ativo: true, tipo: "estudo", studyCategoryId: categoryId },
  });
  const ocorrentesHoje = templates.filter((t) => templateOcorreNoDia(t, dia));

  await Promise.all(
    ocorrentesHoje.map((t) =>
      db.rotinaCheckDia.upsert({
        where: { rotinaId_data: { rotinaId: t.id, data: dia } },
        create: { userId, rotinaId: t.id, data: dia, feitoAuto: true },
        update: {},
      })
    )
  );
}

/** Pausa a sessão (cria uma pausa aberta, se ainda não houver uma). */
export async function pausarSessao(sessionId: string) {
  const { id: userId } = await requireUser();
  const aberta = await db.studyPause.findFirst({
    where: { userId, sessionId, endedAt: null },
  });
  if (!aberta) {
    await db.studyPause.create({
      data: { sessionId, startedAt: new Date(), userId },
    });
  }
  revalidar(userId);
}

/** Retoma: fecha a pausa aberta e grava sua duração. */
export async function retomarSessao(sessionId: string) {
  const { id: userId } = await requireUser();
  const aberta = await db.studyPause.findFirst({
    where: { userId, sessionId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (aberta) {
    const agora = new Date();
    await db.studyPause.update({
      where: { id: aberta.id, userId },
      data: { endedAt: agora, durationSec: diffSec(aberta.startedAt, agora) },
    });
  }
  revalidar(userId);
}

/**
 * Finaliza a sessão: fecha pausa aberta, calcula bruto/líquido e grava.
 */
export async function finalizarSessao(sessionId: string, rating?: number) {
  const { id: userId } = await requireUser();
  const sessao = await db.studySession.findFirst({
    where: { id: sessionId, userId },
    include: { pauses: true },
  });
  if (!sessao || sessao.endedAt) return;

  const agora = new Date();

  // fecha pausa aberta, se houver
  const aberta = sessao.pauses.find((p) => p.endedAt === null);
  if (aberta) {
    await db.studyPause.update({
      where: { id: aberta.id, userId },
      data: { endedAt: agora, durationSec: diffSec(aberta.startedAt, agora) },
    });
  }

  const bruto = diffSec(sessao.startedAt, agora);
  const pausado = sessao.pauses.reduce((t, p) => {
    if (p.id === aberta?.id) return t + diffSec(p.startedAt, agora);
    return t + (p.durationSec || (p.endedAt ? diffSec(p.startedAt, p.endedAt) : 0));
  }, 0);
  const liquido = Math.max(0, bruto - pausado);

  await db.studySession.update({
    where: { id: sessionId, userId },
    data: {
      endedAt: agora,
      totalSeconds: bruto,
      netSeconds: liquido,
      ...(rating != null ? { rating } : {}),
    },
  });
  revalidar(userId);
}

/** Renomeia uma pausa (almoço, descanso...). */
export async function renomearPausa(pausaId: string, label: string) {
  const { id: userId } = await requireUser();
  await db.studyPause.update({
    where: { id: pausaId, userId },
    data: { label: label.trim() || null },
  });
  revalidar(userId);
}

/** Renomeia o assunto/título da sessão. */
export async function renomearSessao(sessionId: string, subject: string) {
  const { id: userId } = await requireUser();
  await db.studySession.update({
    where: { id: sessionId, userId },
    data: { subject: subject.trim() || "Estudo" },
  });
  revalidar(userId);
}

export async function avaliarSessao(sessionId: string, rating: number) {
  const { id: userId } = await requireUser();
  await db.studySession.update({
    where: { id: sessionId, userId },
    data: { rating: Math.max(0, Math.min(5, rating)) },
  });
  revalidar(userId);
}

export async function salvarNotaSessao(sessionId: string, notes: string) {
  const { id: userId } = await requireUser();
  await db.studySession.update({
    where: { id: sessionId, userId },
    data: { notes: notes.trim() || null },
  });
  revalidar(userId);
}

/** Exclui uma sessão (e suas pausas, via cascade). */
export async function excluirSessao(sessionId: string) {
  const { id: userId } = await requireUser();
  await db.studySession.delete({ where: { id: sessionId, userId } });
  revalidar(userId);
}

// ---------- Categorias de estudo (variáveis reutilizáveis) ----------

/** Também invalida o checklist: itens do plano exibem emoji/cor da categoria. */
function revalidarCategorias(userId: string) {
  revalidateTag(tagUsuario(userId, "estudos"));
  revalidateTag(tagUsuario(userId, "checklist"));
  revalidatePath("/estudos");
  revalidatePath("/checklist");
  revalidatePath("/");
}

export async function criarCategoria(input: {
  nome: string;
  emoji?: string;
  cor?: string;
}) {
  const { id: userId } = await requireUser();
  const nome = input.nome.trim();
  if (!nome) return;
  const total = await db.studyCategory.count({ where: { userId, ativo: true } });
  await db.studyCategory.create({
    data: {
      nome,
      emoji: input.emoji?.trim() || "📚",
      cor: input.cor?.trim() || "#6B96D6",
      ordem: total,
      userId,
    },
  });
  revalidarCategorias(userId);
}

export async function atualizarCategoria(
  id: string,
  input: { nome: string; emoji?: string; cor?: string }
) {
  const { id: userId } = await requireUser();
  const nome = input.nome.trim();
  if (!nome) return;
  await db.studyCategory.update({
    where: { id, userId },
    data: {
      nome,
      ...(input.emoji ? { emoji: input.emoji.trim() } : {}),
      ...(input.cor ? { cor: input.cor.trim() } : {}),
    },
  });
  revalidarCategorias(userId);
}

/** Soft-delete: preserva o histórico de sessões e itens que a referenciam. */
export async function excluirCategoria(id: string) {
  const { id: userId } = await requireUser();
  await db.studyCategory.update({
    where: { id, userId },
    data: { ativo: false },
  });
  revalidarCategorias(userId);
}
