'use client'

import { useState } from 'react'
import { Trash2, Plus, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardLabel } from '@/components/caverna/card'
import { EmptyState } from '@/components/caverna/empty-state'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { formatBRL } from '@/lib/money'
import {
  criarMetaPoupanca,
  adicionarContribuicao,
  editarMetaPoupanca,
  removerMetaPoupanca,
  removerContribuicao,
} from '@/app/actions/metas-poupanca'
import { EmojiPicker } from '@/components/ui/emoji-picker'

type Meta = {
  id: string
  nome: string
  emoji: string
  descricao?: string | null
  valorAlvo: number
  valorAtual: number
  concluida: boolean
  contribuicoes: {
    id: string
    valor: number
    fonte: string
    fonteId?: string | null
    descricao?: string | null
    criadoEm: Date
  }[]
}

type Opcao = {
  id: string
  nome: string
  saldo?: number
  bandeira?: string
  tipo?: string
}

export function MetasPoupancaClient({
  metas: metasInitial,
  contaFinanceiraId,
  cartoes,
  contas,
  ativos,
  categorias,
}: {
  metas: Meta[]
  contaFinanceiraId: string
  cartoes: Opcao[]
  contas: Opcao[]
  ativos: Opcao[]
  categorias: Opcao[]
}) {
  const [metas, setMetas] = useState(metasInitial)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<'criar' | 'detalhe'>('criar')
  const [metaSelecionada, setMetaSelecionada] = useState<Meta | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [novaMetaForm, setNovaMetaForm] = useState({
    nome: '',
    emoji: '💰',
    descricao: '',
    valorAlvo: '',
  })

  const [contribuicaoForm, setContribuicaoForm] = useState({
    valor: '',
    fonte: 'manual',
    fonteId: '',
    descricao: '',
  })

  const handleCriarMeta = async () => {
    if (!novaMetaForm.nome || !novaMetaForm.valorAlvo) return

    setLoading(true)
    setErro('')
    try {
      const resultado = await criarMetaPoupanca({
        nome: novaMetaForm.nome,
        emoji: novaMetaForm.emoji,
        descricao: novaMetaForm.descricao,
        valorAlvo: parseFloat(novaMetaForm.valorAlvo),
        contaFinanceiraId,
      })

      setMetas([
        ...metas,
        {
          id: resultado.id,
          nome: resultado.nome,
          emoji: resultado.emoji,
          descricao: resultado.descricao,
          valorAlvo: resultado.valorAlvo / 100,
          valorAtual: 0,
          concluida: false,
          contribuicoes: [],
        },
      ])

      setNovaMetaForm({ nome: '', emoji: '💰', descricao: '', valorAlvo: '' })
      setSheetOpen(false)
    } catch (err: any) {
      setErro(err.message || 'Erro ao criar meta')
    } finally {
      setLoading(false)
    }
  }

  const handleAdicionarContribuicao = async () => {
    if (!metaSelecionada || !contribuicaoForm.valor) return

    setLoading(true)
    setErro('')
    try {
      await adicionarContribuicao({
        metaPoupancaId: metaSelecionada.id,
        valor: parseFloat(contribuicaoForm.valor),
        fonte: contribuicaoForm.fonte as any,
        fonteId: contribuicaoForm.fonteId || undefined,
        descricao: contribuicaoForm.descricao,
      })

      const metaAtualizada = {
        ...metaSelecionada,
        valorAtual: metaSelecionada.valorAtual + parseFloat(contribuicaoForm.valor),
        concluida:
          metaSelecionada.valorAtual + parseFloat(contribuicaoForm.valor) >=
          metaSelecionada.valorAlvo,
      }

      setMetas(metas.map((m) => (m.id === metaSelecionada.id ? metaAtualizada : m)))
      setMetaSelecionada(metaAtualizada)
      setContribuicaoForm({ valor: '', fonte: 'manual', fonteId: '', descricao: '' })
    } catch (err: any) {
      setErro(err.message || 'Erro ao adicionar contribuição')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoverMetaConfirm = async (metaId: string) => {
    if (!window.confirm('Tem certeza que quer remover esta meta?')) return

    setLoading(true)
    setErro('')
    try {
      await removerMetaPoupanca(metaId)
      setMetas(metas.filter((m) => m.id !== metaId))
      setSheetOpen(false)
      setMetaSelecionada(null)
    } catch (err: any) {
      setErro(err.message || 'Erro ao remover meta')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoverContribuicao = async (contribuicaoId: string) => {
    if (!window.confirm('Remover esta contribuição?')) return

    setLoading(true)
    setErro('')
    try {
      await removerContribuicao(contribuicaoId)
      if (metaSelecionada) {
        const contribuicao = metaSelecionada.contribuicoes.find(
          (c) => c.id === contribuicaoId
        )
        if (contribuicao) {
          const metaAtualizada = {
            ...metaSelecionada,
            valorAtual: metaSelecionada.valorAtual - contribuicao.valor,
            concluida: false,
            contribuicoes: metaSelecionada.contribuicoes.filter(
              (c) => c.id !== contribuicaoId
            ),
          }
          setMetas(metas.map((m) => (m.id === metaSelecionada.id ? metaAtualizada : m)))
          setMetaSelecionada(metaAtualizada)
        }
      }
    } catch (err: any) {
      setErro(err.message || 'Erro ao remover contribuição')
    } finally {
      setLoading(false)
    }
  }

  const abrirDetalhes = (meta: Meta) => {
    setMetaSelecionada(meta)
    setSheetMode('detalhe')
    setErro('')
    setSheetOpen(true)
  }

  const getOpcoesParaFonte = (fonte: string): Opcao[] => {
    switch (fonte) {
      case 'cartao':
        return cartoes
      case 'conta':
        return contas
      case 'investimento':
        return ativos
      case 'receita':
        return categorias
      default:
        return []
    }
  }

  const rotulFonte: Record<string, string> = {
    receita: 'Receita',
    investimento: 'Investimento',
    cartao: 'Cartão',
    conta: 'Conta',
    manual: 'Manual',
  }

  const saldoDisponivel = (): string | null => {
    if (contribuicaoForm.fonte === 'manual' || !contribuicaoForm.fonteId) return null

    const opcoes = getOpcoesParaFonte(contribuicaoForm.fonte)
    const opcao = opcoes.find((o) => o.id === contribuicaoForm.fonteId)

    if (opcao?.saldo !== undefined) {
      return formatBRL(opcao.saldo)
    }
    return null
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <CardLabel>Metas de poupança</CardLabel>
          <p className="mt-1 text-[12.5px] text-steel">
            Defina alvos de poupança e acompanhe seu progresso
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setSheetMode('criar')
            setErro('')
            setSheetOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          Nova meta
        </Button>
      </div>

      {metas.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="Nenhuma meta de poupança criada."
        />
      ) : (
        <div className="space-y-4">
          {metas.map((meta) => {
            const percentual = (meta.valorAtual / meta.valorAlvo) * 100
            const faltam = Math.max(0, meta.valorAlvo - meta.valorAtual)

            return (
              <Card
                key={meta.id}
                className="cursor-pointer hover:border-mint transition-colors"
                onClick={() => abrirDetalhes(meta)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{meta.emoji}</span>
                      <h3 className="text-[13px] font-medium text-ice">
                        {meta.nome}
                      </h3>
                      {meta.concluida && (
                        <Check className="h-4 w-4 text-mint" />
                      )}
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="flex items-baseline gap-3">
                        <span className="text-[13px] text-mist">
                          {formatBRL(meta.valorAtual * 100)}
                        </span>
                        <span className="text-[12.5px] text-steel">
                          de {formatBRL(meta.valorAlvo * 100)}
                        </span>
                      </div>

                      <div className="w-full h-1.5 bg-stroke rounded-full overflow-hidden">
                        <div
                          className="h-full bg-mint rounded-full transition-all"
                          style={{ width: `${Math.min(percentual, 100)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[11.5px] text-steel">
                          {Math.round(percentual)}% completo
                        </span>
                        {!meta.concluida && (
                          <span className="text-[11.5px] text-mist">
                            Faltam {formatBRL(faltam * 100)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetTitle>
            {sheetMode === 'criar' ? 'Nova meta de poupança' : 'Detalhes da meta'}
          </SheetTitle>

          {erro && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-[12.5px] text-red-400">
              {erro}
            </div>
          )}

          {sheetMode === 'criar' ? (
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-[12.5px] font-medium text-ice block mb-1">
                  Emoji
                </label>
                <EmojiPicker
                  value={novaMetaForm.emoji}
                  onChange={(emoji) =>
                    setNovaMetaForm({ ...novaMetaForm, emoji })
                  }
                />
              </div>

              <div>
                <label className="text-[12.5px] font-medium text-ice block mb-1">
                  Nome da meta
                </label>
                <input
                  type="text"
                  value={novaMetaForm.nome}
                  onChange={(e) =>
                    setNovaMetaForm({ ...novaMetaForm, nome: e.target.value })
                  }
                  placeholder="Ex: Viagem para Maldivas"
                  className="w-full px-3 py-2 text-[13px] bg-canvas border border-stroke rounded-md focus:outline-none focus:border-mint"
                />
              </div>

              <div>
                <label className="text-[12.5px] font-medium text-ice block mb-1">
                  Descrição (opcional)
                </label>
                <textarea
                  value={novaMetaForm.descricao}
                  onChange={(e) =>
                    setNovaMetaForm({ ...novaMetaForm, descricao: e.target.value })
                  }
                  placeholder="Descreva seus planos..."
                  rows={3}
                  className="w-full px-3 py-2 text-[13px] bg-canvas border border-stroke rounded-md focus:outline-none focus:border-mint resize-none"
                />
              </div>

              <div>
                <label className="text-[12.5px] font-medium text-ice block mb-1">
                  Valor-alvo (R$)
                </label>
                <input
                  type="number"
                  value={novaMetaForm.valorAlvo}
                  onChange={(e) =>
                    setNovaMetaForm({ ...novaMetaForm, valorAlvo: e.target.value })
                  }
                  placeholder="0,00"
                  step="0.01"
                  className="w-full px-3 py-2 text-[13px] bg-canvas border border-stroke rounded-md focus:outline-none focus:border-mint"
                />
              </div>

              <Button
                onClick={handleCriarMeta}
                disabled={loading || !novaMetaForm.nome || !novaMetaForm.valorAlvo}
                className="w-full mt-6"
              >
                {loading ? 'Criando...' : 'Criar meta'}
              </Button>
            </div>
          ) : metaSelecionada ? (
            <div className="mt-6 space-y-6">
              <div>
                <h3 className="text-[13px] font-medium text-ice mb-2 flex items-center gap-2">
                  <span className="text-xl">{metaSelecionada.emoji}</span>
                  {metaSelecionada.nome}
                </h3>
                {metaSelecionada.descricao && (
                  <p className="text-[12.5px] text-steel">
                    {metaSelecionada.descricao}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-[13px] text-mist">
                    {formatBRL(metaSelecionada.valorAtual * 100)}
                  </span>
                  <span className="text-[12.5px] text-steel">
                    de {formatBRL(metaSelecionada.valorAlvo * 100)}
                  </span>
                </div>
                <div className="w-full h-2 bg-stroke rounded-full overflow-hidden">
                  <div
                    className="h-full bg-mint rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        (metaSelecionada.valorAtual / metaSelecionada.valorAlvo) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="text-[12.5px] font-medium text-ice block mb-3">
                  Adicionar contribuição
                </label>
                <div className="space-y-3">
                  <input
                    type="number"
                    value={contribuicaoForm.valor}
                    onChange={(e) => {
                      setContribuicaoForm({
                        ...contribuicaoForm,
                        valor: e.target.value,
                      })
                      setErro('')
                    }}
                    placeholder="Valor (R$)"
                    step="0.01"
                    className="w-full px-3 py-2 text-[13px] bg-canvas border border-stroke rounded-md focus:outline-none focus:border-mint"
                  />

                  <select
                    value={contribuicaoForm.fonte}
                    onChange={(e) => {
                      setContribuicaoForm({
                        ...contribuicaoForm,
                        fonte: e.target.value,
                        fonteId: '',
                      })
                      setErro('')
                    }}
                    className="w-full px-3 py-2 text-[13px] bg-canvas border border-stroke rounded-md focus:outline-none focus:border-mint"
                  >
                    <option value="manual">Manual</option>
                    <option value="receita">Receita</option>
                    <option value="cartao">Cartão</option>
                    <option value="conta">Conta</option>
                    <option value="investimento">Investimento</option>
                  </select>

                  {contribuicaoForm.fonte !== 'manual' && (
                    <div>
                      <select
                        value={contribuicaoForm.fonteId}
                        onChange={(e) => {
                          setContribuicaoForm({
                            ...contribuicaoForm,
                            fonteId: e.target.value,
                          })
                          setErro('')
                        }}
                        className="w-full px-3 py-2 text-[13px] bg-canvas border border-stroke rounded-md focus:outline-none focus:border-mint"
                      >
                        <option value="">Selecione...</option>
                        {getOpcoesParaFonte(contribuicaoForm.fonte).map((opcao) => (
                          <option key={opcao.id} value={opcao.id}>
                            {opcao.nome}
                            {opcao.saldo !== undefined &&
                              ` · ${formatBRL(opcao.saldo)}`}
                          </option>
                        ))}
                      </select>

                      {saldoDisponivel() && (
                        <p className="mt-1 text-[11.5px] text-steel">
                          Disponível: {saldoDisponivel()}
                        </p>
                      )}
                    </div>
                  )}

                  <input
                    type="text"
                    value={contribuicaoForm.descricao}
                    onChange={(e) =>
                      setContribuicaoForm({
                        ...contribuicaoForm,
                        descricao: e.target.value,
                      })
                    }
                    placeholder="Descrição (opcional)"
                    className="w-full px-3 py-2 text-[13px] bg-canvas border border-stroke rounded-md focus:outline-none focus:border-mint"
                  />

                  <Button
                    onClick={handleAdicionarContribuicao}
                    disabled={loading || !contribuicaoForm.valor}
                    size="sm"
                    className="w-full"
                  >
                    {loading ? 'Adicionando...' : 'Adicionar contribuição'}
                  </Button>
                </div>
              </div>

              {metaSelecionada.contribuicoes.length > 0 && (
                <div>
                  <label className="text-[12.5px] font-medium text-ice block mb-3">
                    Histórico de contribuições
                  </label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {metaSelecionada.contribuicoes.map((contrib) => (
                      <div
                        key={contrib.id}
                        className="flex items-center justify-between gap-2 p-2 bg-canvas border border-stroke rounded-md"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[12.5px] text-ice font-medium">
                              {formatBRL(contrib.valor * 100)}
                            </span>
                            <span className="text-[11.5px] text-steel">
                              {rotulFonte[contrib.fonte]}
                            </span>
                          </div>
                          {contrib.descricao && (
                            <p className="text-[11.5px] text-mist truncate">
                              {contrib.descricao}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoverContribuicao(contrib.id)
                          }}
                          className="shrink-0 p-1 hover:bg-stroke rounded transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-mist" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={() => handleRemoverMetaConfirm(metaSelecionada.id)}
                disabled={loading}
                variant="ghost"
                className="w-full text-red-400 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
                Remover meta
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}
