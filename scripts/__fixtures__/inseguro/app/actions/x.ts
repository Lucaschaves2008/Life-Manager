"use server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function semLogin(id: string) {
  return db.item.delete({ where: { id } });
}

export async function recebeUserId(userId: string) {
  await requireUser();
  return userId;
}

export async function massAssignment(id: string, input: { nome: string }) {
  const { id: userId } = await requireUser();
  return db.item.update({ where: { id, userId }, data: { ...input } });
}
