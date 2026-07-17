"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function toggleGoal(id: string, feito: boolean) {
  await db.goal.update({ where: { id }, data: { feito } });
  revalidatePath("/");
  revalidatePath("/metas");
}

export async function createGoal(titulo: string, mes: string) {
  const count = await db.goal.count({ where: { mes } });
  await db.goal.create({ data: { titulo, mes, ordem: count } });
  revalidatePath("/");
  revalidatePath("/metas");
}

export async function updateGoal(id: string, titulo: string) {
  await db.goal.update({ where: { id }, data: { titulo } });
  revalidatePath("/");
  revalidatePath("/metas");
}

export async function deleteGoal(id: string) {
  await db.goal.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/metas");
}

export async function restoreGoal(titulo: string, mes: string, feito: boolean) {
  await db.goal.create({ data: { titulo, mes, feito } });
  revalidatePath("/");
  revalidatePath("/metas");
}
