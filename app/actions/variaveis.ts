"use server";

import { revalidatePath, revalidateTag } from "@/lib/cache-revalidate";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { tagUsuario } from "@/lib/cache-tags";
import { spStartOfDay } from "@/lib/dates";

function revalidar(userId: string) {
  revalidateTag(tagUsuario(userId, "checklist"));
  revalidateTag(tagUsuario(userId, "metas"));
  revalidatePath("/checklist");
  revalidatePath("/metas");
  revalidatePath("/desafios");
  revalidatePath("/");
}

/** Início do dia em SP a partir de "yyyy-MM-dd", como Date UTC. */
function dataDoDia(dia: string): Date {
  return spStartOfDay(new Date(`${dia}T12:00:00-03:00`));
}

export type VariavelInput = {
  nome: string;
  emoji?: string;
  cor?: string;
  medeStreak: boolean;
  medeContagem: boolean;
};

function validarInput(input: VariavelInput): { nome: string; medeStreak: boolean; medeContagem: boolean } | null {
  const nome = input.nome.trim();
  if (!nome) return null;
  if (!input.medeStreak && !input.medeContagem) return null;
  return { nome, medeStreak: input.medeStreak, medeContagem: input.medeContagem };
}

export async function criarVariavel(input: VariavelInput) {
  const { id: userId } = await requireUser();
  const validado = validarInput(input);
  if (!validado) throw new Error("Nome obrigatório e ao menos um tipo de progresso deve ficar ligado.");

  const total = await db.variavel.count({ where: { userId, ativo: true } });
  await db.variavel.create({
    data: {
      nome: validado.nome,
      medeStreak: validado.medeStreak,
      medeContagem: validado.medeContagem,
      emoji: input.emoji || undefined,
      cor: input.cor || undefined,
      ordem: total,
      userId,
    },
  });
  revalidar(userId);
}

export async function atualizarVariavel(id: string, input: VariavelInput) {
  const { id: userId } = await requireUser();
  const validado = validarInput(input);
  if (!validado) throw new Error("Nome obrigatório e ao menos um tipo de progresso deve ficar ligado.");

  const existente = await db.variavel.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existente) throw new Error("Variável não encontrada — recarregue a página.");

  await db.variavel.update({
    where: { id, userId },
    data: {
      nome: validado.nome,
      medeStreak: validado.medeStreak,
      medeContagem: validado.medeContagem,
      emoji: input.emoji || undefined,
      cor: input.cor || undefined,
    },
  });
  revalidar(userId);
}

export async function excluirVariavel(id: string) {
  const { id: userId } = await requireUser();
  await db.variavel.update({ where: { id, userId }, data: { ativo: false } });
  revalidar(userId);
}

/** Troca a ordem da variável com o vizinho (direcao -1 = sobe, 1 = desce). */
export async function moverVariavel(id: string, direcao: -1 | 1) {
  const { id: userId } = await requireUser();
  const irmas = await db.variavel.findMany({
    where: { userId, ativo: true },
    orderBy: { ordem: "asc" },
  });
  const i = irmas.findIndex((v) => v.id === id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= irmas.length) return;

  await db.$transaction([
    db.variavel.update({ where: { id: irmas[i].id, userId }, data: { ordem: irmas[j].ordem } }),
    db.variavel.update({ where: { id: irmas[j].id, userId }, data: { ordem: irmas[i].ordem } }),
  ]);
  revalidar(userId);
}

/** Marca/desmarca a variável no dia (upsert/delete de VariavelCheckDia). */
export async function toggleVariavelCheckDia(variavelId: string, dia: string) {
  const { id: userId } = await requireUser();
  const variavel = await db.variavel.findFirst({
    where: { id: variavelId, userId },
    select: { id: true },
  });
  if (!variavel) throw new Error("Variável não encontrada — recarregue a página.");

  const data = dataDoDia(dia);
  const existente = await db.variavelCheckDia.findFirst({
    where: { userId, variavelId, data },
  });
  if (existente) {
    await db.variavelCheckDia.delete({ where: { id: existente.id } });
  } else {
    await db.variavelCheckDia.create({ data: { userId, variavelId, data } });
  }
  revalidar(userId);
}
