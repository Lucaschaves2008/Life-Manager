'use server'

import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import { tagUsuario } from '@/lib/cache-tags'

function revalidar(userId: string) {
  revalidatePath('/financas')
  revalidatePath('/')
  revalidateTag(tagUsuario(userId, 'financas'))
}

export async function criarMetaPoupanca(data: {
  nome: string
  emoji: string
  descricao?: string
  valorAlvo: number
  contaFinanceiraId: string
}) {
  const user = await requireUser()

  const meta = await db.metaPoupanca.create({
    data: {
      userId: user.id,
      nome: data.nome,
      emoji: data.emoji,
      descricao: data.descricao,
      valorAlvo: Math.round(data.valorAlvo * 100),
      valorAtual: 0,
      contaFinanceiraId: data.contaFinanceiraId,
    },
  })

  revalidar(user.id)
  return meta
}

export async function adicionarContribuicao(data: {
  metaPoupancaId: string
  valor: number
  fonte: string
  fonteId?: string
  descricao?: string
}) {
  const user = await requireUser()

  const meta = await db.metaPoupanca.findUnique({
    where: { id: data.metaPoupancaId },
  })

  if (!meta || meta.userId !== user.id) {
    throw new Error('Meta não encontrada')
  }

  const valorCentavos = Math.round(data.valor * 100)

  const contribuicao = await db.metaPoupancaContribuicao.create({
    data: {
      userId: user.id,
      metaPoupancaId: data.metaPoupancaId,
      valor: valorCentavos,
      fonte: data.fonte,
      fonteId: data.fonteId,
      descricao: data.descricao,
    },
  })

  const novoValorAtual = meta.valorAtual + valorCentavos

  await db.metaPoupanca.update({
    where: { id: data.metaPoupancaId },
    data: {
      valorAtual: novoValorAtual,
      concluida: novoValorAtual >= meta.valorAlvo,
    },
  })

  revalidar(user.id)
  return contribuicao
}

export async function editarMetaPoupanca(
  id: string,
  data: {
    nome?: string
    emoji?: string
    descricao?: string
    valorAlvo?: number
  }
) {
  const user = await requireUser()

  const meta = await db.metaPoupanca.findUnique({
    where: { id },
  })

  if (!meta || meta.userId !== user.id) {
    throw new Error('Meta não encontrada')
  }

  const atualizada = await db.metaPoupanca.update({
    where: { id },
    data: {
      nome: data.nome ?? meta.nome,
      emoji: data.emoji ?? meta.emoji,
      descricao: data.descricao ?? meta.descricao,
      valorAlvo: data.valorAlvo ? Math.round(data.valorAlvo * 100) : meta.valorAlvo,
    },
  })

  revalidar(user.id)
  return atualizada
}

export async function removerMetaPoupanca(id: string) {
  const user = await requireUser()

  const meta = await db.metaPoupanca.findUnique({
    where: { id },
  })

  if (!meta || meta.userId !== user.id) {
    throw new Error('Meta não encontrada')
  }

  await db.metaPoupanca.delete({
    where: { id },
  })

  revalidar(user.id)
}

export async function removerContribuicao(contribuicaoId: string) {
  const user = await requireUser()

  const contribuicao = await db.metaPoupancaContribuicao.findUnique({
    where: { id: contribuicaoId },
  })

  if (!contribuicao || contribuicao.userId !== user.id) {
    throw new Error('Contribuição não encontrada')
  }

  const meta = await db.metaPoupanca.findUnique({
    where: { id: contribuicao.metaPoupancaId },
  })

  if (!meta) throw new Error('Meta não encontrada')

  await db.metaPoupancaContribuicao.delete({
    where: { id: contribuicaoId },
  })

  const novoValorAtual = meta.valorAtual - contribuicao.valor

  await db.metaPoupanca.update({
    where: { id: meta.id },
    data: {
      valorAtual: Math.max(0, novoValorAtual),
      concluida: false,
    },
  })

  revalidar(user.id)
}
