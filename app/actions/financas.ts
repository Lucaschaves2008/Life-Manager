"use server";

import { addMonths } from "date-fns";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

function revalidar() {
  revalidatePath("/financas");
  revalidatePath("/");
}

export type TransacaoInput = {
  tipo: "despesa" | "receita" | "transferencia";
  valor: number;
  data: string; // yyyy-MM-dd
  descricao: string;
  accountId: string;
  contraAccountId?: string | null;
  categoryId?: string | null;
  cardId?: string | null;
  tags: string[];
  recorrente?: boolean;
  parcelas?: number;
};

/** Converte yyyy-MM-dd (horário de São Paulo, meio-dia) num Date estável. */
function dataSP(dia: string): Date {
  return new Date(`${dia}T12:00:00-03:00`);
}

export async function createTransacao(input: TransacaoInput) {
  const base = {
    tipo: input.tipo,
    valor: input.valor,
    descricao: input.descricao,
    tags: JSON.stringify(input.tags ?? []),
    recorrente: input.recorrente ?? false,
    accountId: input.accountId,
    contraAccountId: input.tipo === "transferencia" ? input.contraAccountId ?? null : null,
    categoryId: input.tipo === "transferencia" ? null : input.categoryId ?? null,
    cardId: input.cardId ?? null,
  };

  const parcelas = Math.max(1, Math.floor(input.parcelas ?? 1));

  if (parcelas > 1) {
    const grupo = `pg_${Date.now().toString(36)}`;
    const inicio = dataSP(input.data);
    await db.transaction.createMany({
      data: Array.from({ length: parcelas }, (_, i) => ({
        ...base,
        data: addMonths(inicio, i),
        parcelaGrupo: grupo,
        parcelaNum: i + 1,
        parcelaTotal: parcelas,
      })),
    });
  } else {
    await db.transaction.create({ data: { ...base, data: dataSP(input.data) } });
  }

  revalidar();
}

export async function updateTransacao(id: string, input: TransacaoInput) {
  await db.transaction.update({
    where: { id },
    data: {
      tipo: input.tipo,
      valor: input.valor,
      data: dataSP(input.data),
      descricao: input.descricao,
      tags: JSON.stringify(input.tags ?? []),
      accountId: input.accountId,
      contraAccountId:
        input.tipo === "transferencia" ? input.contraAccountId ?? null : null,
      categoryId: input.tipo === "transferencia" ? null : input.categoryId ?? null,
      cardId: input.cardId ?? null,
    },
  });
  revalidar();
}

export async function duplicateTransacao(id: string) {
  const tx = await db.transaction.findUnique({ where: { id } });
  if (!tx) return;
  const { id: _id, criadoEm: _criadoEm, ...resto } = tx;
  await db.transaction.create({
    data: { ...resto, parcelaGrupo: null, parcelaNum: null, parcelaTotal: null },
  });
  revalidar();
}

/** Exclui e devolve os dados para o "Desfazer" recriar a transação. */
export async function deleteTransacao(id: string) {
  const tx = await db.transaction.findUnique({ where: { id } });
  if (!tx) return null;
  await db.transaction.delete({ where: { id } });
  revalidar();
  return tx;
}

export async function restoreTransacao(dados: {
  tipo: string;
  valor: number;
  data: Date;
  descricao: string;
  tags: string;
  recorrente: boolean;
  parcelaGrupo: string | null;
  parcelaNum: number | null;
  parcelaTotal: number | null;
  paga: boolean;
  accountId: string;
  categoryId: string | null;
  cardId: string | null;
  contraAccountId: string | null;
}) {
  await db.transaction.create({ data: dados });
  revalidar();
}

/** Exclui todas as parcelas de um parcelamento. */
export async function deleteParcelamento(grupo: string) {
  await db.transaction.deleteMany({ where: { parcelaGrupo: grupo } });
  revalidar();
}

// ---------- Categorias ----------

export type CategoriaInput = {
  nome: string;
  emoji: string;
  cor: string;
  tipo: "despesa" | "receita";
  orcamentoMensal?: number | null;
};

export async function createCategoria(input: CategoriaInput) {
  const cat = await db.category.create({
    data: { ...input, orcamentoMensal: input.orcamentoMensal ?? null },
  });
  revalidar();
  return cat;
}

export async function updateCategoria(id: string, input: CategoriaInput) {
  await db.category.update({
    where: { id },
    data: { ...input, orcamentoMensal: input.orcamentoMensal ?? null },
  });
  revalidar();
}

export async function deleteCategoria(id: string) {
  await db.category.delete({ where: { id } });
  revalidar();
}

// ---------- Cartões ----------

export type CartaoInput = {
  nome: string;
  bandeira: string;
  limite: number;
  fechamento: number;
  vencimento: number;
  cor: string;
};

export async function createCartao(input: CartaoInput) {
  await db.card.create({ data: input });
  revalidar();
}

export async function updateCartao(id: string, input: CartaoInput) {
  await db.card.update({ where: { id }, data: input });
  revalidar();
}

export async function deleteCartao(id: string) {
  await db.card.delete({ where: { id } });
  revalidar();
}

// ---------- Assinaturas ----------

export type AssinaturaInput = {
  nome: string;
  emoji: string;
  valor: number;
  diaCobranca: number;
  status: "ativa" | "pausada";
};

export async function createAssinatura(input: AssinaturaInput) {
  await db.subscription.create({ data: input });
  revalidar();
}

export async function updateAssinatura(id: string, input: AssinaturaInput) {
  const atual = await db.subscription.findUnique({ where: { id } });
  await db.subscription.update({
    where: { id },
    data: {
      ...input,
      valorAnterior:
        atual && atual.valor !== input.valor ? atual.valor : atual?.valorAnterior,
    },
  });
  revalidar();
}

export async function deleteAssinatura(id: string) {
  const s = await db.subscription.findUnique({ where: { id } });
  await db.subscription.delete({ where: { id } });
  revalidar();
  return s;
}

export async function restoreAssinatura(dados: AssinaturaInput) {
  await db.subscription.create({ data: dados });
  revalidar();
}
