"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  LIMITE_CONTAS_FINANCEIRAS,
  EMAIL_SUPORTE_LIMITE,
  COOKIE_CONTA_ATIVA,
  type ContaFinanceiraView,
} from "@/lib/contas-financeiras-shared";

/** Lista as contas financeiras do usuário; garante que "Pessoal" sempre exista. */
export async function listarContasFinanceiras(
  userId: string
): Promise<ContaFinanceiraView[]> {
  const contas = await db.contaFinanceira.findMany({
    where: { userId },
    orderBy: [{ padrao: "desc" }, { criadoEm: "asc" }],
  });
  if (contas.length > 0) return contas;

  const pessoal = await db.contaFinanceira.create({
    data: { userId, nome: "Pessoal", padrao: true },
  });
  return [pessoal];
}

export async function criarContaFinanceira(nome: string, cor: string) {
  const { id: userId } = await requireUser();
  const total = await db.contaFinanceira.count({ where: { userId } });
  if (total >= LIMITE_CONTAS_FINANCEIRAS) {
    throw new Error(
      `Limite de ${LIMITE_CONTAS_FINANCEIRAS} contas atingido. Para liberar mais, envie um e-mail para ${EMAIL_SUPORTE_LIMITE}.`
    );
  }

  const conta = await db.contaFinanceira.create({
    data: { userId, nome: nome.trim(), cor, padrao: false },
  });
  revalidatePath("/financas");
  revalidatePath("/investimentos");
  return conta;
}

export async function renomearContaFinanceira(id: string, nome: string, cor: string) {
  const { id: userId } = await requireUser();
  const conta = await db.contaFinanceira.findFirst({ where: { id, userId } });
  if (!conta) throw new Error("Conta financeira não encontrada.");

  const atualizada = await db.contaFinanceira.update({
    where: { id },
    data: { nome: nome.trim(), cor },
  });
  revalidatePath("/financas");
  revalidatePath("/investimentos");
  return atualizada;
}

/** Exclui uma conta extra e todo o histórico financeiro vinculado a ela (cascade no banco). A conta padrão nunca pode ser excluída. */
export async function excluirContaFinanceira(id: string) {
  const { id: userId } = await requireUser();
  const conta = await db.contaFinanceira.findFirst({ where: { id, userId } });
  if (!conta) throw new Error("Conta financeira não encontrada.");
  if (conta.padrao) throw new Error("A conta padrão não pode ser excluída.");

  await db.contaFinanceira.delete({ where: { id } });

  // se a conta excluída era a ativa, volta o cookie para a conta padrão
  const cookieStore = await cookies();
  if (cookieStore.get(COOKIE_CONTA_ATIVA)?.value === id) {
    const pessoal = await db.contaFinanceira.findFirst({
      where: { userId, padrao: true },
    });
    if (pessoal) {
      cookieStore.set(COOKIE_CONTA_ATIVA, pessoal.id, {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
  }

  revalidatePath("/financas");
  revalidatePath("/investimentos");
}

/** Grava a conta ativa em cookie; reflete imediatamente em Finanças e Investimentos. */
export async function setContaAtiva(contaId: string) {
  const { id: userId } = await requireUser();
  const conta = await db.contaFinanceira.findFirst({
    where: { id: contaId, userId },
    select: { id: true },
  });
  if (!conta) throw new Error("Conta financeira não encontrada.");

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_CONTA_ATIVA, conta.id, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/financas");
  revalidatePath("/investimentos");
}
