"use server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { apenas } from "@/lib/utils";

export async function renomear(id: string, input: { nome: string }) {
  const { id: userId } = await requireUser();
  return db.item.update({ where: { id, userId }, data: apenas(input, { nome: true }) });
}
