"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { tagUsuario } from "@/lib/cache-tags";
import type { MetaMetrica, MetaPeriodo } from "@/lib/data/metas-quantitativas";

function revalidar(userId: string) {
  revalidateTag(tagUsuario(userId, "metas"));
  revalidatePath("/");
  revalidatePath("/metas");
}

export type MetaQuantitativaInput = {
  titulo: string;
  metrica: MetaMetrica;
  alvo: number;
  periodo: MetaPeriodo;
  chave: string;
};

export async function criarMetaQuantitativa(input: MetaQuantitativaInput) {
  const { id: userId } = await requireUser();
  const count = await db.metaQuantitativa.count({ where: { userId } });
  await db.metaQuantitativa.create({
    data: { ...input, ordem: count, userId },
  });
  revalidar(userId);
}

export async function editarMetaQuantitativa(id: string, input: MetaQuantitativaInput) {
  const { id: userId } = await requireUser();
  await db.metaQuantitativa.update({ where: { id, userId }, data: input });
  revalidar(userId);
}

export async function excluirMetaQuantitativa(id: string) {
  const { id: userId } = await requireUser();
  await db.metaQuantitativa.delete({ where: { id, userId } });
  revalidar(userId);
}
