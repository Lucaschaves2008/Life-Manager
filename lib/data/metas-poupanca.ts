import { db } from '@/lib/db'
import { unstable_cache } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { tagUsuario } from '@/lib/cache-tags'

export const obterMetasPoupanca = unstable_cache(
  async (contaFinanceiraId: string) => {
    const user = await getCurrentUser()
    if (!user?.id) return []

    const metas = await db.metaPoupanca.findMany({
      where: {
        userId: user.id,
        contaFinanceiraId,
      },
      include: {
        contribuicoes: {
          orderBy: { criadoEm: 'desc' },
        },
      },
      orderBy: { criadoEm: 'desc' },
    })

    return metas.map((meta) => ({
      ...meta,
      valorAlvo: meta.valorAlvo / 100,
      valorAtual: meta.valorAtual / 100,
      contribuicoes: meta.contribuicoes.map((c) => ({
        ...c,
        valor: c.valor / 100,
      })),
    }))
  },
  ['metas-poupanca'],
  {
    tags: [tagUsuario('PLACEHOLDER', 'financas')],
    revalidate: 3600,
  }
)

export const obterDetalhesMetaPoupanca = unstable_cache(
  async (metaId: string) => {
    const user = await getCurrentUser()
    if (!user?.id) return null

    const meta = await db.metaPoupanca.findUnique({
      where: { id: metaId },
      include: {
        contribuicoes: {
          orderBy: { criadoEm: 'desc' },
        },
      },
    })

    if (!meta || meta.userId !== user.id) return null

    return {
      ...meta,
      valorAlvo: meta.valorAlvo / 100,
      valorAtual: meta.valorAtual / 100,
      contribuicoes: meta.contribuicoes.map((c) => ({
        ...c,
        valor: c.valor / 100,
      })),
    }
  },
  ['metas-poupanca'],
  {
    tags: [tagUsuario('PLACEHOLDER', 'financas')],
    revalidate: 3600,
  }
)
