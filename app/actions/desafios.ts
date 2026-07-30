"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { DesafioOrigem, DesafioPeriodo } from "@/lib/data/desafios";
import type { MetaMetrica } from "@/lib/data/metas-quantitativas";
import { mensagensDoDesafio, type MensagemView } from "@/lib/data/desafios-chat";
import { documentoDoDesafio, type DesafioDocumentoView } from "@/lib/data/desafios-documento";
import { uploadDesafioDocumento, removeDesafioDocumento } from "@/lib/supabase/storage";

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
  variavelId?: string;
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
  if (input.origem === "variavel") {
    if (!input.variavelId) throw new Error("Escolha uma variável.");
    const variavel = await db.variavel.findFirst({
      where: { id: input.variavelId, userId },
    });
    if (!variavel) throw new Error("Variável não encontrada.");
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
      variavelId: input.origem === "variavel" ? (input.variavelId ?? null) : null,
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
      variavelId: input.origem === "variavel" ? (input.variavelId ?? null) : null,
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
      variavelId: input.origem === "variavel" ? (input.variavelId ?? null) : null,
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

const LIMITE_TEXTO_MENSAGEM = 500;

/** Envia uma mensagem no chat do desafio. Só membros podem escrever. */
export async function enviarMensagem(desafioId: string, texto: string) {
  const { id: userId } = await requireUser();
  await requireMembro(desafioId, userId);

  const limpo = texto.trim().slice(0, LIMITE_TEXTO_MENSAGEM);
  if (!limpo) throw new Error("Escreva uma mensagem.");

  await db.desafioMensagem.create({ data: { desafioId, userId, texto: limpo } });
  revalidatePath(`/desafios/${desafioId}`);
}

/** Busca as mensagens atuais — usado pelo cliente de chat via polling. */
export async function buscarMensagens(desafioId: string): Promise<MensagemView[]> {
  const { id: userId } = await requireUser();
  await requireMembro(desafioId, userId);
  return mensagensDoDesafio(desafioId);
}

const TIPOS_DOCUMENTO_ACEITOS = ["application/pdf", "image/png", "image/jpeg"];
const TAMANHO_MAX_DOCUMENTO = 25 * 1024 * 1024; // 25MB

/** Sobe (ou substitui) o documento fixado do desafio — "o contrato do grupo". Qualquer membro pode enviar. */
export async function enviarDocumento(desafioId: string, formData: FormData): Promise<void> {
  const { id: userId } = await requireUser();
  await requireMembro(desafioId, userId);

  const nomeLimpo = String(formData.get("nome") ?? "").trim().slice(0, 80);
  const file = formData.get("file");
  if (!nomeLimpo) throw new Error("Dê um nome ao documento.");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecione um arquivo.");
  }
  if (!TIPOS_DOCUMENTO_ACEITOS.includes(file.type)) {
    throw new Error("Formato inválido. Envie um PDF, JPG ou PNG.");
  }
  if (file.size > TAMANHO_MAX_DOCUMENTO) {
    throw new Error("Arquivo muito grande. Limite de 25MB.");
  }

  const arquivoUrl = await uploadDesafioDocumento(desafioId, file);

  await db.desafioDocumento.upsert({
    where: { desafioId },
    create: { desafioId, nome: nomeLimpo, arquivoUrl, arquivoTipo: file.type, enviadoPorId: userId },
    update: { nome: nomeLimpo, arquivoUrl, arquivoTipo: file.type, enviadoPorId: userId },
  });
  revalidar(desafioId);
}

/** Busca o documento fixado atual — usado pelo cliente após upload. */
export async function buscarDocumento(desafioId: string): Promise<DesafioDocumentoView | null> {
  const { id: userId } = await requireUser();
  await requireMembro(desafioId, userId);
  return documentoDoDesafio(desafioId);
}

/** Remove o documento fixado. Só o criador do desafio ou quem enviou pode excluir. */
export async function excluirDocumento(desafioId: string) {
  const { id: userId } = await requireUser();
  await requireMembro(desafioId, userId);

  const doc = await db.desafioDocumento.findUnique({ where: { desafioId } });
  if (!doc) return;
  if (doc.enviadoPorId !== userId) {
    await requireCriador(desafioId, userId);
  }

  await db.desafioDocumento.delete({ where: { desafioId } });
  await removeDesafioDocumento(desafioId);
  revalidar(desafioId);
}
