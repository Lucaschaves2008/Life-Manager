import { db } from "@/lib/db";

/**
 * Solicitações de mudança nas metas de um desafio.
 *
 * Regra do grupo: num desafio com mais de um membro, ninguém mexe nas metas
 * (nem nas próprias) sem o aval de TODOS. Cada pedido vira uma solicitação
 * com um resumo legível da mudança; só quando todos os membros atuais votam
 * "aprovar" é que a mudança é aplicada de verdade.
 */

export type SolicitacaoTipo =
  | "criar_meta"
  | "editar_meta"
  | "excluir_meta"
  | "ajuste_progresso";

export type SolicitacaoStatus = "pendente" | "aprovada" | "recusada" | "cancelada";

export const ROTULO_TIPO_SOLICITACAO: Record<SolicitacaoTipo, string> = {
  criar_meta: "Nova meta",
  editar_meta: "Mudança de meta",
  excluir_meta: "Excluir meta",
  ajuste_progresso: "Ajuste de progresso",
};

export type VotoView = {
  userId: string;
  nome: string;
  aprovado: boolean;
};

export type SolicitacaoView = {
  id: string;
  tipo: SolicitacaoTipo;
  status: SolicitacaoStatus;
  resumo: string;
  metaTitulo: string;
  justificativa: string | null;
  autorId: string;
  autorNome: string;
  souAutor: boolean;
  criadoEm: string;
  votos: VotoView[];
  /** Quantos membros já aprovaram e quantos precisam aprovar (todos). */
  aprovacoes: number;
  totalMembros: number;
  /** Nomes de quem ainda não votou — o que trava o pedido. */
  faltamVotar: string[];
  /** Voto do viewer: true/false se já votou, null se ainda não. */
  meuVoto: boolean | null;
};

const LIMITE_HISTORICO = 8;

/**
 * Pendentes (mais antigas primeiro — são as que travam o grupo) seguidas do
 * histórico recente já resolvido.
 */
export async function solicitacoesDoDesafio(
  desafioId: string,
  viewerId: string
): Promise<SolicitacaoView[]> {
  const [pendentes, resolvidas, membros] = await Promise.all([
    db.desafioSolicitacao.findMany({
      where: { desafioId, status: "pendente" },
      orderBy: { criadoEm: "asc" },
      include: { votos: true },
    }),
    db.desafioSolicitacao.findMany({
      where: { desafioId, status: { not: "pendente" } },
      orderBy: { resolvidoEm: "desc" },
      take: LIMITE_HISTORICO,
      include: { votos: true },
    }),
    db.desafioMembro.findMany({ where: { desafioId }, select: { userId: true } }),
  ]);

  const solicitacoes = [...pendentes, ...resolvidas];
  if (solicitacoes.length === 0) return [];

  const idsEnvolvidos = new Set<string>(membros.map((m) => m.userId));
  for (const s of solicitacoes) {
    idsEnvolvidos.add(s.autorId);
    for (const v of s.votos) idsEnvolvidos.add(v.userId);
  }
  const perfis = await db.profile.findMany({
    where: { id: { in: [...idsEnvolvidos] } },
    select: { id: true, nome: true },
  });
  const nomePorId = new Map(perfis.map((p) => [p.id, p.nome ?? "Sem nome"]));
  const nome = (id: string) => nomePorId.get(id) ?? "Sem nome";

  const membrosAtuais = membros.map((m) => m.userId);

  return solicitacoes.map((s) => {
    // Só votos de quem AINDA é membro contam — quem saiu do desafio não trava
    // nem aprova mais nada.
    const votosValidos = s.votos.filter((v) => membrosAtuais.includes(v.userId));
    const votouPorId = new Map(votosValidos.map((v) => [v.userId, v.aprovado]));
    const meu = votouPorId.get(viewerId);

    return {
      id: s.id,
      tipo: s.tipo as SolicitacaoTipo,
      status: s.status as SolicitacaoStatus,
      resumo: s.resumo,
      metaTitulo: s.metaTitulo,
      justificativa: s.justificativa,
      autorId: s.autorId,
      autorNome: nome(s.autorId),
      souAutor: s.autorId === viewerId,
      criadoEm: s.criadoEm.toISOString(),
      votos: votosValidos.map((v) => ({
        userId: v.userId,
        nome: nome(v.userId),
        aprovado: v.aprovado,
      })),
      aprovacoes: votosValidos.filter((v) => v.aprovado).length,
      totalMembros: membrosAtuais.length,
      faltamVotar: membrosAtuais.filter((id) => !votouPorId.has(id)).map(nome),
      meuVoto: meu === undefined ? null : meu,
    };
  });
}

/** Quantidade de solicitações esperando o voto do usuário — alimenta o badge. */
export async function solicitacoesAguardandoMeuVoto(
  desafioId: string,
  userId: string
): Promise<number> {
  const pendentes = await db.desafioSolicitacao.findMany({
    where: { desafioId, status: "pendente" },
    select: { id: true, votos: { where: { userId }, select: { id: true } } },
  });
  return pendentes.filter((s) => s.votos.length === 0).length;
}
