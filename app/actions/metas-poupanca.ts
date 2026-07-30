'use server'

import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { revalidatePath, revalidateTag } from '@/lib/cache-revalidate'
import { tagUsuario } from '@/lib/cache-tags'
import { nowSP, dayKeySP } from '@/lib/dates'

function revalidar(userId: string) {
  revalidatePath('/financas')
  revalidatePath('/investimentos')
  revalidatePath('/')
  revalidateTag(tagUsuario(userId, 'financas'))
  revalidateTag(tagUsuario(userId, 'investimentos'))
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
  fonte: 'receita' | 'investimento' | 'cartao' | 'conta' | 'manual'
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
  let transactionId: string | null = null
  let assetMovementId: string | null = null

  // Valida e processa cada tipo de fonte
  if (data.fonte === 'cartao' && data.fonteId) {
    const cartao = await db.card.findUnique({
      where: { id: data.fonteId },
    })

    if (!cartao || cartao.userId !== user.id) {
      throw new Error('Cartão não encontrado')
    }

    // Cria transaction de despesa para o cartão (simula pagamento/transferência)
    const tx = await db.transaction.create({
      data: {
        userId: user.id,
        contaFinanceiraId: meta.contaFinanceiraId,
        tipo: 'despesa',
        valor: valorCentavos,
        data: nowSP(),
        descricao: `Contribuição para meta: ${meta.nome}`,
        cardId: data.fonteId,
        paga: true,
        tags: JSON.stringify(['meta-poupanca']),
      },
    })
    transactionId = tx.id
  } else if (data.fonte === 'conta' && data.fonteId) {
    const conta = await db.account.findUnique({
      where: { id: data.fonteId },
    })

    if (!conta || conta.userId !== user.id || conta.contaFinanceiraId !== meta.contaFinanceiraId) {
      throw new Error('Conta não encontrada')
    }

    // Valida saldo
    const saldoAtual = conta.saldoInicial
    if (saldoAtual < valorCentavos) {
      throw new Error(`Saldo insuficiente. Disponível: R$ ${(saldoAtual / 100).toFixed(2)}`)
    }

    // Cria transaction de despesa (saída da conta)
    const tx = await db.transaction.create({
      data: {
        userId: user.id,
        contaFinanceiraId: meta.contaFinanceiraId,
        tipo: 'despesa',
        valor: valorCentavos,
        data: nowSP(),
        descricao: `Contribuição para meta: ${meta.nome}`,
        accountId: data.fonteId,
        paga: true,
        tags: JSON.stringify(['meta-poupanca']),
      },
    })
    transactionId = tx.id
  } else if (data.fonte === 'investimento' && data.fonteId) {
    const ativo = await db.asset.findUnique({
      where: { id: data.fonteId },
      include: {
        movements: {
          orderBy: { data: 'desc' },
          take: 1,
        },
      },
    })

    if (!ativo || ativo.userId !== user.id || ativo.contaFinanceiraId !== meta.contaFinanceiraId) {
      throw new Error('Investimento não encontrado')
    }

    // Calcula saldo atual do ativo
    const saldoAtivo =
      ativo.movements.length > 0 ? ativo.movements[0].valor : 0

    if (saldoAtivo < valorCentavos) {
      throw new Error(`Saldo insuficiente no investimento. Disponível: R$ ${(saldoAtivo / 100).toFixed(2)}`)
    }

    // Cria asset movement de retirada
    const movimento = await db.assetMovement.create({
      data: {
        userId: user.id,
        contaFinanceiraId: meta.contaFinanceiraId,
        assetId: data.fonteId,
        tipo: 'retirada',
        valor: -valorCentavos,
        data: nowSP(),
        nota: `Contribuição para meta: ${meta.nome}`,
      },
    })
    assetMovementId = movimento.id
  } else if (data.fonte === 'receita' && data.fonteId) {
    // Valida categoria de receita
    const categoria = await db.category.findUnique({
      where: { id: data.fonteId },
    })

    if (!categoria || categoria.userId !== user.id || categoria.tipo !== 'receita') {
      throw new Error('Categoria de receita não encontrada')
    }
  }
  // fonte === 'manual' não precisa de validação

  // Cria contribuição
  const contribuicao = await db.metaPoupancaContribuicao.create({
    data: {
      userId: user.id,
      metaPoupancaId: data.metaPoupancaId,
      valor: valorCentavos,
      fonte: data.fonte,
      fonteId: data.fonteId ?? undefined,
      descricao: data.descricao ?? undefined,
      ...(transactionId && { transactionId }),
      ...(assetMovementId && { assetMovementId }),
    },
  })

  // Atualiza valor_atual da meta
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
    select: {
      id: true,
      userId: true,
      metaPoupancaId: true,
      transactionId: true,
      assetMovementId: true,
    },
  })

  if (!contribuicao || contribuicao.userId !== user.id) {
    throw new Error('Contribuição não encontrada')
  }

  const meta = await db.metaPoupanca.findUnique({
    where: { id: contribuicao.metaPoupancaId },
  })

  if (!meta) throw new Error('Meta não encontrada')

  // Remove transações/movimentos criados
  if (contribuicao.transactionId) {
    await db.transaction.delete({
      where: { id: contribuicao.transactionId },
    })
  }

  if (contribuicao.assetMovementId) {
    await db.assetMovement.delete({
      where: { id: contribuicao.assetMovementId },
    })
  }

  // Remove contribuição
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
