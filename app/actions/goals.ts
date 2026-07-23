"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { tagUsuario } from "@/lib/cache-tags";

function revalidar(userId: string) {
  revalidateTag(tagUsuario(userId, "metas"));
  revalidatePath("/");
  revalidatePath("/metas");
}

export async function toggleGoal(id: string, feito: boolean) {
  const { id: userId } = await requireUser();
  await db.goal.update({ where: { id, userId }, data: { feito } });
  revalidar(userId);
}

export async function createGoal(titulo: string, mes: string) {
  const { id: userId } = await requireUser();
  const count = await db.goal.count({ where: { userId, mes } });
  await db.goal.create({ data: { titulo, mes, ordem: count, userId } });
  revalidar(userId);
}

export async function updateGoal(id: string, titulo: string) {
  const { id: userId } = await requireUser();
  await db.goal.update({ where: { id, userId }, data: { titulo } });
  revalidar(userId);
}

export async function deleteGoal(id: string) {
  const { id: userId } = await requireUser();
  await db.goal.delete({ where: { id, userId } });
  revalidar(userId);
}

export async function restoreGoal(titulo: string, mes: string, feito: boolean) {
  const { id: userId } = await requireUser();
  await db.goal.create({ data: { titulo, mes, feito, userId } });
  revalidar(userId);
}
