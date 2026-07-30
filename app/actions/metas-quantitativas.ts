"use server";

import { revalidatePath, revalidateTag } from "@/lib/cache-revalidate";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { tagUsuario } from "@/lib/cache-tags";
import type { MetaMetrica, MetaOrigem, MetaPeriodo } from "@/lib/data/metas-quantitativas";

function revalidar(userId: string) {
  revalidateTag(tagUsuario(userId, "metas"));
  revalidatePath("/");
  revalidatePath("/metas");
}

export type MetaQuantitativaInput = {
  titulo: string;
  origem: MetaOrigem;
  metrica?: MetaMetrica | null;
  variavelId?: string | null;
  alvo: number;
  periodo: MetaPeriodo;
  chave: string;
};

/** Resolve os campos de origem, validando propriedade da variável (vínculo fraco: degrada p/ null). */
async function resolverOrigem(userId: string, input: MetaQuantitativaInput) {
  if (input.origem === "variavel") {
    const variavel = input.variavelId
      ? await db.variavel.findFirst({ where: { id: input.variavelId, userId }, select: { id: true } })
      : null;
    return { origem: "variavel" as const, metrica: null, variavelId: variavel?.id ?? null };
  }
  return { origem: "metrica" as const, metrica: input.metrica ?? null, variavelId: null };
}

export async function criarMetaQuantitativa(input: MetaQuantitativaInput) {
  const { id: userId } = await requireUser();
  const resolvido = await resolverOrigem(userId, input);
  const count = await db.metaQuantitativa.count({ where: { userId } });
  await db.metaQuantitativa.create({
    data: {
      titulo: input.titulo,
      alvo: input.alvo,
      periodo: input.periodo,
      chave: input.chave,
      ...resolvido,
      ordem: count,
      userId,
    },
  });
  revalidar(userId);
}

export async function editarMetaQuantitativa(id: string, input: MetaQuantitativaInput) {
  const { id: userId } = await requireUser();
  const resolvido = await resolverOrigem(userId, input);
  await db.metaQuantitativa.update({
    where: { id, userId },
    data: {
      titulo: input.titulo,
      alvo: input.alvo,
      periodo: input.periodo,
      chave: input.chave,
      ...resolvido,
    },
  });
  revalidar(userId);
}

export async function excluirMetaQuantitativa(id: string) {
  const { id: userId } = await requireUser();
  await db.metaQuantitativa.delete({ where: { id, userId } });
  revalidar(userId);
}
