"use server";

import { revalidatePath, revalidateTag } from "@/lib/cache-revalidate";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { tagUsuario } from "@/lib/cache-tags";

/**
 * Lançamento manual de dinheiro ganho — fonte única da métrica "dinheiro"
 * usada por MetaQuantitativa e DesafioMeta (ver lib/data/metas-quantitativas.ts
 * e lib/data/desafios.ts). Um lançamento reflete automaticamente em qualquer
 * meta/desafio que use essa métrica, sem precisar escolher "qual meta".
 */
function revalidar(userId: string) {
  revalidateTag(tagUsuario(userId, "metas"));
  revalidatePath("/");
  revalidatePath("/metas");
  revalidatePath("/desafios");
}

export type DinheiroLancamentoInput = {
  valor: number; // em reais
  descricao?: string | null;
  data: string; // yyyy-MM-dd
};

function dataSP(dia: string): Date {
  return new Date(`${dia}T12:00:00-03:00`);
}

export async function lancarDinheiro(input: DinheiroLancamentoInput) {
  const { id: userId } = await requireUser();
  await db.dinheiroLancamento.create({
    data: {
      userId,
      valor: Math.round(input.valor * 100),
      descricao: input.descricao?.trim() || null,
      data: dataSP(input.data),
    },
  });
  revalidar(userId);
}

export async function excluirDinheiroLancamento(id: string) {
  const { id: userId } = await requireUser();
  await db.dinheiroLancamento.delete({ where: { id, userId } });
  revalidar(userId);
}

export type DinheiroLancamentoView = {
  id: string;
  valor: number; // em reais
  descricao: string | null;
  data: string;
};

export async function dinheiroLancamentosRecentes(
  userId: string,
  limite = 20
): Promise<DinheiroLancamentoView[]> {
  const registros = await db.dinheiroLancamento.findMany({
    where: { userId },
    orderBy: { data: "desc" },
    take: limite,
  });
  return registros.map((r) => ({
    id: r.id,
    valor: r.valor / 100,
    descricao: r.descricao,
    data: r.data.toISOString().slice(0, 10),
  }));
}
