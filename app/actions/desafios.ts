"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { DesafioOrigem, DesafioPeriodo } from "@/lib/data/desafios";
import type { MetaMetrica } from "@/lib/data/metas-quantitativas";

// lib/data/desafios.ts não usa "use cache" (progresso cruza dados de outros
// usuários/módulos — cache por tag de um único userId não se aplica aqui),
// então a leitura já é sempre fresh; só precisamos invalidar as rotas.
function revalidar(desafioId?: string) {
  revalidatePath("/desafios");
  if (desafioId) revalidatePath(`/desafios/${desafioId}`);
}

const ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I (ambíguos)

function gerarCodigo(): string {
  let codigo = "";
  for (let i = 0; i < 6; i++) {
    codigo += ALFABETO_CODIGO[Math.floor(Math.random() * ALFABETO_CODIGO.length)];
  }
  return codigo;
}

async function codigoUnico(): Promise<string> {
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    const codigo = gerarCodigo();
    const existe = await db.desafio.findUnique({ where: { codigo }, select: { id: true } });
    if (!existe) return codigo;
  }
  throw new Error("Não foi possível gerar um código único. Tente novamente.");
}

async function requireMembro(desafioId: string, userId: string) {
  const membro = await db.desafioMembro.findUnique({
    where: { desafioId_userId: { desafioId, userId } },
  });
  if (!membro) throw new Error("Você não participa deste desafio.");
}

async function requireCriador(desafioId: string, userId: string) {
  const desafio = await db.desafio.findUnique({ where: { id: desafioId }, select: { criadorId: true } });
  if (!desafio) throw new Error("Desafio não encontrado.");
  if (desafio.criadorId !== userId) throw new Error("Só o criador do desafio pode fazer isso.");
  return desafio;
}

export async function criarDesafio(input: { nome: string; descricao?: string; metasGrandesLimite: number }) {
  const { id: userId } = await requireUser();
  const nome = input.nome.trim();
  if (!nome) throw new Error("Dê um nome ao desafio.");
  const limite = Math.min(10, Math.max(1, Math.round(input.metasGrandesLimite)));

  const codigo = await codigoUnico();
  const desafio = await db.desafio.create({
    data: {
      nome,
      descricao: input.descricao?.trim() || null,
      codigo,
      metasGrandesLimite: limite,
      criadorId: userId,
      membros: { create: { userId } },
    },
  });
  revalidar(desafio.id);
  return desafio;
}

export async function entrarNoDesafio(codigoInput: string) {
  const { id: userId } = await requireUser();
  const codigo = codigoInput.trim().toUpperCase();
  const desafio = await db.desafio.findUnique({ where: { codigo }, select: { id: true, ativo: true } });
  if (!desafio || !desafio.ativo) throw new Error("Código inválido.");

  const jaMembro = await db.desafioMembro.findUnique({
    where: { desafioId_userId: { desafioId: desafio.id, userId } },
  });
  if (jaMembro) throw new Error("Você já faz parte deste desafio.");

  await db.desafioMembro.create({ data: { desafioId: desafio.id, userId } });
  revalidar(desafio.id);
  return desafio.id;
}

export async function sairDoDesafio(desafioId: string) {
  const { id: userId } = await requireUser();
  await db.desafioMembro.deleteMany({ where: { desafioId, userId } });
  await db.desafioMeta.deleteMany({ where: { desafioId, userId } });
  revalidar(desafioId);
}

export async function removerMembro(desafioId: string, membroUserId: string) {
  const { id: userId } = await requireUser();
  await requireCriador(desafioId, userId);
  if (membroUserId === userId) throw new Error("O criador não pode se remover — exclua o desafio.");
  await db.desafioMembro.deleteMany({ where: { desafioId, userId: membroUserId } });
  await db.desafioMeta.deleteMany({ where: { desafioId, userId: membroUserId } });
  revalidar(desafioId);
}

export async function excluirDesafio(desafioId: string) {
  const { id: userId } = await requireUser();
  await requireCriador(desafioId, userId);
  await db.desafio.update({ where: { id: desafioId }, data: { ativo: false } });
  revalidar(desafioId);
}

export type DesafioMetaInput = {
  titulo: string;
  origem: DesafioOrigem;
  metrica?: MetaMetrica;
  rotinaTemplateId?: string;
  alvo: number;
  periodo: DesafioPeriodo;
};

async function validarOrigemInput(userId: string, input: DesafioMetaInput) {
  if (input.origem === "checklist") {
    if (!input.rotinaTemplateId) throw new Error("Escolha um item do checklist.");
    const template = await db.rotinaTemplate.findFirst({
      where: { id: input.rotinaTemplateId, userId },
    });
    if (!template) throw new Error("Item de checklist não encontrado.");
  }
}

/** Cada membro cria as PRÓPRIAS metas grandes, respeitando o limite do desafio. */
export async function criarMetaGrande(desafioId: string, input: DesafioMetaInput) {
  const { id: userId } = await requireUser();
  await requireMembro(desafioId, userId);
  await validarOrigemInput(userId, input);

  const desafio = await db.desafio.findUnique({ where: { id: desafioId }, select: { metasGrandesLimite: true } });
  if (!desafio) throw new Error("Desafio não encontrado.");

  const count = await db.desafioMeta.count({ where: { desafioId, userId, metaPaiId: null } });
  if (count >= desafio.metasGrandesLimite) {
    throw new Error(`Limite de ${desafio.metasGrandesLimite} metas grandes atingido.`);
  }

  await db.desafioMeta.create({
    data: {
      desafioId,
      userId,
      titulo: input.titulo.trim(),
      origem: input.origem,
      metrica: input.origem === "metrica" ? (input.metrica ?? null) : null,
      rotinaTemplateId: input.origem === "checklist" ? (input.rotinaTemplateId ?? null) : null,
      alvo: input.alvo,
      periodo: input.periodo,
      ordem: count,
    },
  });
  revalidar(desafioId);
}

export async function criarMetaPequena(desafioId: string, metaPaiId: string, input: DesafioMetaInput) {
  const { id: userId } = await requireUser();
  await requireMembro(desafioId, userId);
  await validarOrigemInput(userId, input);

  const pai = await db.desafioMeta.findFirst({
    where: { id: metaPaiId, desafioId, userId, metaPaiId: null },
  });
  if (!pai) throw new Error("Meta grande não encontrada.");

  const count = await db.desafioMeta.count({ where: { metaPaiId } });
  await db.desafioMeta.create({
    data: {
      desafioId,
      userId,
      metaPaiId,
      titulo: input.titulo.trim(),
      origem: input.origem,
      metrica: input.origem === "metrica" ? (input.metrica ?? null) : null,
      rotinaTemplateId: input.origem === "checklist" ? (input.rotinaTemplateId ?? null) : null,
      alvo: input.alvo,
      periodo: input.periodo,
      ordem: count,
    },
  });
  revalidar(desafioId);
}

export async function editarMeta(metaId: string, input: DesafioMetaInput) {
  const { id: userId } = await requireUser();
  await validarOrigemInput(userId, input);

  const meta = await db.desafioMeta.findFirst({ where: { id: metaId, userId } });
  if (!meta) throw new Error("Meta não encontrada.");

  await db.desafioMeta.update({
    where: { id: metaId },
    data: {
      titulo: input.titulo.trim(),
      origem: input.origem,
      metrica: input.origem === "metrica" ? (input.metrica ?? null) : null,
      rotinaTemplateId: input.origem === "checklist" ? (input.rotinaTemplateId ?? null) : null,
      alvo: input.alvo,
      periodo: input.periodo,
    },
  });
  revalidar(meta.desafioId);
}

export async function excluirMeta(metaId: string) {
  const { id: userId } = await requireUser();
  const meta = await db.desafioMeta.findFirst({ where: { id: metaId, userId } });
  if (!meta) throw new Error("Meta não encontrada.");

  await db.desafioMeta.delete({ where: { id: metaId } });
  revalidar(meta.desafioId);
}
