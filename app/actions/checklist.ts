"use server";

import { revalidatePath, revalidateTag } from "@/lib/cache-revalidate";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { tagUsuario } from "@/lib/cache-tags";
import { spEndOfDay, spStartOfDay } from "@/lib/dates";
import { parseJSON } from "@/lib/utils";

function revalidar(userId: string) {
  revalidateTag(tagUsuario(userId, "checklist"));
  revalidatePath("/checklist");
  revalidatePath("/");
}

function dataSP(dia: string): Date {
  return new Date(`${dia}T12:00:00-03:00`);
}

export async function createHabit(nome: string, nota?: string) {
  const { id: userId } = await requireUser();
  const total = await db.habit.count({ where: { userId } });
  await db.habit.create({
    data: { nome: nome.trim(), nota: nota?.trim() || null, ordem: total, userId },
  });
  revalidar(userId);
}

export async function updateHabit(id: string, nome: string, nota?: string) {
  const { id: userId } = await requireUser();
  await db.habit.update({
    where: { id, userId },
    data: { nome: nome.trim(), nota: nota?.trim() || null },
  });
  revalidar(userId);
}

export async function deleteHabit(id: string) {
  const { id: userId } = await requireUser();
  await db.habit.update({ where: { id, userId }, data: { ativo: false } });
  revalidar(userId);
}

/** Troca a ordem do hábito com o vizinho (direcao -1 = sobe, 1 = desce). */
export async function moveHabit(id: string, direcao: -1 | 1) {
  const { id: userId } = await requireUser();
  const irmaos = await db.habit.findMany({
    where: { userId, ativo: true },
    orderBy: { ordem: "asc" },
  });
  const i = irmaos.findIndex((h) => h.id === id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= irmaos.length) return;

  await db.$transaction([
    db.habit.update({ where: { id: irmaos[i].id, userId }, data: { ordem: irmaos[j].ordem } }),
    db.habit.update({ where: { id: irmaos[j].id, userId }, data: { ordem: irmaos[i].ordem } }),
  ]);
  revalidar(userId);
}

async function logDoDia(userId: string, dia: string) {
  const data = dataSP(dia);
  const existente = await db.habitDayLog.findFirst({
    where: { userId, data: { gte: spStartOfDay(data), lte: spEndOfDay(data) } },
  });
  if (existente) return existente;
  return db.habitDayLog.create({ data: { data: spStartOfDay(data), userId } });
}

export async function toggleHabitDia(habitId: string, dia: string) {
  const { id: userId } = await requireUser();
  const log = await logDoDia(userId, dia);
  const atuais = parseJSON<string[]>(log.itensFeitos, []);
  const proximos = atuais.includes(habitId)
    ? atuais.filter((id) => id !== habitId)
    : [...atuais, habitId];

  await db.habitDayLog.update({
    where: { id: log.id, userId },
    data: { itensFeitos: JSON.stringify(proximos) },
  });
  revalidar(userId);
}
