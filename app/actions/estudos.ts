"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

function revalidar() {
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
}) {
  const emAndamento = await db.studySession.findFirst({
    where: { endedAt: null },
  });
  if (emAndamento) await finalizarSessao(emAndamento.id);

  const subject = input.subject.trim() || "Estudo";
  const sessao = await db.studySession.create({
    data: {
      subject,
      startedAt: new Date(),
      targetMinutes: input.targetMinutes ?? null,
    },
  });
  revalidar();
  return sessao.id;
}

/** Pausa a sessão (cria uma pausa aberta, se ainda não houver uma). */
export async function pausarSessao(sessionId: string) {
  const aberta = await db.studyPause.findFirst({
    where: { sessionId, endedAt: null },
  });
  if (!aberta) {
    await db.studyPause.create({
      data: { sessionId, startedAt: new Date() },
    });
  }
  revalidar();
}

/** Retoma: fecha a pausa aberta e grava sua duração. */
export async function retomarSessao(sessionId: string) {
  const aberta = await db.studyPause.findFirst({
    where: { sessionId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (aberta) {
    const agora = new Date();
    await db.studyPause.update({
      where: { id: aberta.id },
      data: { endedAt: agora, durationSec: diffSec(aberta.startedAt, agora) },
    });
  }
  revalidar();
}

/**
 * Finaliza a sessão: fecha pausa aberta, calcula bruto/líquido e grava.
 */
export async function finalizarSessao(sessionId: string, rating?: number) {
  const sessao = await db.studySession.findUnique({
    where: { id: sessionId },
    include: { pauses: true },
  });
  if (!sessao || sessao.endedAt) return;

  const agora = new Date();

  // fecha pausa aberta, se houver
  const aberta = sessao.pauses.find((p) => p.endedAt === null);
  if (aberta) {
    await db.studyPause.update({
      where: { id: aberta.id },
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
    where: { id: sessionId },
    data: {
      endedAt: agora,
      totalSeconds: bruto,
      netSeconds: liquido,
      ...(rating != null ? { rating } : {}),
    },
  });
  revalidar();
}

/** Renomeia uma pausa (almoço, descanso...). */
export async function renomearPausa(pausaId: string, label: string) {
  await db.studyPause.update({
    where: { id: pausaId },
    data: { label: label.trim() || null },
  });
  revalidar();
}

/** Renomeia o assunto/título da sessão. */
export async function renomearSessao(sessionId: string, subject: string) {
  await db.studySession.update({
    where: { id: sessionId },
    data: { subject: subject.trim() || "Estudo" },
  });
  revalidar();
}

export async function avaliarSessao(sessionId: string, rating: number) {
  await db.studySession.update({
    where: { id: sessionId },
    data: { rating: Math.max(0, Math.min(5, rating)) },
  });
  revalidar();
}

export async function salvarNotaSessao(sessionId: string, notes: string) {
  await db.studySession.update({
    where: { id: sessionId },
    data: { notes: notes.trim() || null },
  });
  revalidar();
}

/** Exclui uma sessão (e suas pausas, via cascade). */
export async function excluirSessao(sessionId: string) {
  await db.studySession.delete({ where: { id: sessionId } });
  revalidar();
}
