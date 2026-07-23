"use server";

import { addMonths } from "date-fns";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { tagUsuario } from "@/lib/cache-tags";

/** Revalida as rotas e derruba o cache "use cache" do módulo finanças. */
function revalidar(userId: string) {
  revalidatePath("/financas");
  revalidatePath("/");
  revalidateTag(tagUsuario(userId, "financas"));
}

export type TipoPonta = "conta" | "cartao" | "ativo";

export type TransacaoInput = {
  tipo: "despesa" | "receita" | "transferencia";
  valor: number;
  data: string; // yyyy-MM-dd
  descricao: string;
  accountId: string;
  categoryId?: string | null;
  cardId?: string | null;
  /** Só usados quando tipo === "transferencia". */
  origemTipo?: TipoPonta | null;
  origemId?: string | null;
  destinoTipo?: TipoPonta | null;
  destinoId?: string | null;
  tags: string[];
  recorrente?: boolean;
  parcelas?: number;
};

/** Converte yyyy-MM-dd (horário de São Paulo, meio-dia) num Date estável. */
function dataSP(dia: string): Date {
  return new Date(`${dia}T12:00:00-03:00`);
}

/** Garante que os FKs vindos do cliente pertencem ao usuário. */
async function validarPosse(
  userId: string,
  ids: {
    accountId?: string | null;
    categoryId?: string | null;
    cardId?: string | null;
  }
) {
  const checks: Promise<{ id: string } | null>[] = [];
  if (ids.accountId)
    checks.push(
      db.account.findFirst({ where: { id: ids.accountId, userId }, select: { id: true } })
    );
  if (ids.categoryId)
    checks.push(
      db.category.findFirst({ where: { id: ids.categoryId, userId }, select: { id: true } })
    );
  if (ids.cardId)
    checks.push(
      db.card.findFirst({ where: { id: ids.cardId, userId }, select: { id: true } })
    );
  const encontrados = await Promise.all(checks);
  if (encontrados.some((r) => !r)) throw new Error("Recurso não encontrado.");
}

type Ponta = { tipo: TipoPonta; id: string };

/**
 * Valida uma ponta (conta/cartão/ativo) de uma transferência. Sem FK no
 * banco: uma ponta apontando para um registro já excluído (ou de outro
 * usuário) degrada para null em vez de rejeitar a edição — mesmo espírito do
 * antigo contraAccountId, agora estendido às 3 pontas possíveis.
 */
async function pontaValida(
  userId: string,
  tipo?: TipoPonta | null,
  id?: string | null
): Promise<Ponta | null> {
  if (!tipo || !id) return null;
  const registro =
    tipo === "conta"
      ? await db.account.findFirst({ where: { id, userId }, select: { id: true } })
      : tipo === "cartao"
        ? await db.card.findFirst({ where: { id, userId }, select: { id: true } })
        : await db.asset.findFirst({ where: { id, userId }, select: { id: true } });
  return registro ? { tipo, id } : null;
}

/**
 * Cria/atualiza o(s) AssetMovement espelho de uma transferência que toca
 * Ativo (resgate se origem=ativo, aporte se destino=ativo — ambos quando a
 * transferência é Ativo → Ativo). Marcado com transactionId para poder ser
 * localizado e ressincronizado/removido junto da Transaction.
 */
async function sincronizarMovimentoDoAtivo(
  userId: string,
  transactionId: string,
  origem: Ponta | null,
  destino: Ponta | null,
  valor: number,
  data: string
) {
  await db.assetMovement.deleteMany({ where: { userId, transactionId } });

  const novos: { assetId: string; tipo: string }[] = [];
  if (origem?.tipo === "ativo") novos.push({ assetId: origem.id, tipo: "resgate" });
  if (destino?.tipo === "ativo") novos.push({ assetId: destino.id, tipo: "aporte" });

  if (novos.length > 0) {
    await db.assetMovement.createMany({
      data: novos.map((n) => ({
        userId,
        assetId: n.assetId,
        tipo: n.tipo,
        valor,
        data: dataSP(data),
        transactionId,
      })),
    });
  }
}

/** Resolve as pontas de uma transferência e deriva accountId/cardId legados a partir delas. */
async function resolverPontasTransferencia(userId: string, input: TransacaoInput) {
  const [origem, destino] = await Promise.all([
    pontaValida(userId, input.origemTipo, input.origemId),
    pontaValida(userId, input.destinoTipo, input.destinoId),
  ]);
  const pontaDoTipo = (t: TipoPonta) =>
    origem?.tipo === t ? origem : destino?.tipo === t ? destino : null;
  return {
    origem,
    destino,
    accountId: pontaDoTipo("conta")?.id ?? null,
    cardId: pontaDoTipo("cartao")?.id ?? null,
  };
}

export async function createTransacao(input: TransacaoInput) {
  const { id: userId } = await requireUser();
  const transferencia = input.tipo === "transferencia";
  const pontas = transferencia ? await resolverPontasTransferencia(userId, input) : null;

  const base = {
    userId,
    tipo: input.tipo,
    valor: input.valor,
    descricao: input.descricao,
    tags: JSON.stringify(input.tags ?? []),
    recorrente: input.recorrente ?? false,
    accountId: transferencia ? pontas!.accountId : input.accountId,
    categoryId: transferencia ? null : input.categoryId ?? null,
    cardId: transferencia ? pontas!.cardId : input.cardId ?? null,
    origemTipo: pontas?.origem?.tipo ?? null,
    origemId: pontas?.origem?.id ?? null,
    destinoTipo: pontas?.destino?.tipo ?? null,
    destinoId: pontas?.destino?.id ?? null,
  };
  if (!transferencia) await validarPosse(userId, base);

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
    const tx = await db.transaction.create({ data: { ...base, data: dataSP(input.data) } });
    if (transferencia) {
      await sincronizarMovimentoDoAtivo(
        userId,
        tx.id,
        pontas!.origem,
        pontas!.destino,
        input.valor,
        input.data
      );
    }
  }

  revalidar(userId);
}

export async function updateTransacao(id: string, input: TransacaoInput) {
  const { id: userId } = await requireUser();
  const transferencia = input.tipo === "transferencia";
  const pontas = transferencia ? await resolverPontasTransferencia(userId, input) : null;

  const data = {
    tipo: input.tipo,
    valor: input.valor,
    data: dataSP(input.data),
    descricao: input.descricao,
    tags: JSON.stringify(input.tags ?? []),
    accountId: transferencia ? pontas!.accountId : input.accountId,
    categoryId: transferencia ? null : input.categoryId ?? null,
    cardId: transferencia ? pontas!.cardId : input.cardId ?? null,
    origemTipo: pontas?.origem?.tipo ?? null,
    origemId: pontas?.origem?.id ?? null,
    destinoTipo: pontas?.destino?.tipo ?? null,
    destinoId: pontas?.destino?.id ?? null,
  };
  if (!transferencia) await validarPosse(userId, data);
  await db.transaction.update({ where: { id, userId }, data });

  if (transferencia) {
    await sincronizarMovimentoDoAtivo(
      userId,
      id,
      pontas!.origem,
      pontas!.destino,
      input.valor,
      input.data
    );
  } else {
    await db.assetMovement.deleteMany({ where: { userId, transactionId: id } });
  }

  revalidar(userId);
}

export async function duplicateTransacao(id: string) {
  const { id: userId } = await requireUser();
  const tx = await db.transaction.findFirst({ where: { id, userId } });
  if (!tx) return;
  const { id: _id, criadoEm: _criadoEm, ...resto } = tx;
  const nova = await db.transaction.create({
    data: { ...resto, parcelaGrupo: null, parcelaNum: null, parcelaTotal: null },
  });
  if (tx.tipo === "transferencia") {
    await sincronizarMovimentoDoAtivo(
      userId,
      nova.id,
      tx.origemTipo === "ativo" && tx.origemId ? { tipo: "ativo", id: tx.origemId } : null,
      tx.destinoTipo === "ativo" && tx.destinoId ? { tipo: "ativo", id: tx.destinoId } : null,
      tx.valor,
      tx.data.toISOString().slice(0, 10)
    );
  }
  revalidar(userId);
}

/** Exclui e devolve os dados (+ movimentos de ativo espelho) para o "Desfazer" recriar a transação. */
export async function deleteTransacao(id: string) {
  const { id: userId } = await requireUser();
  const tx = await db.transaction.findFirst({ where: { id, userId } });
  if (!tx) return null;
  const movimentosAtivo = await db.assetMovement.findMany({
    where: { userId, transactionId: id },
  });
  await db.assetMovement.deleteMany({ where: { userId, transactionId: id } });
  await db.transaction.delete({ where: { id, userId } });
  revalidar(userId);
  return { ...tx, movimentosAtivo };
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
  accountId: string | null;
  categoryId: string | null;
  cardId: string | null;
  contraAccountId: string | null;
  origemTipo: string | null;
  origemId: string | null;
  destinoTipo: string | null;
  destinoId: string | null;
  movimentosAtivo?: {
    tipo: string;
    valor: number;
    data: Date;
    nota: string | null;
    assetId: string;
  }[];
}) {
  const { id: userId } = await requireUser();
  const { movimentosAtivo, ...dadosTx } = dados;
  await validarPosse(userId, dadosTx);
  const nova = await db.transaction.create({ data: { ...dadosTx, userId } });
  if (movimentosAtivo && movimentosAtivo.length > 0) {
    await db.assetMovement.createMany({
      data: movimentosAtivo.map((m) => ({ ...m, userId, transactionId: nova.id })),
    });
  }
  revalidar(userId);
}

/** Exclui todas as parcelas de um parcelamento. */
export async function deleteParcelamento(grupo: string) {
  const { id: userId } = await requireUser();
  await db.transaction.deleteMany({ where: { userId, parcelaGrupo: grupo } });
  revalidar(userId);
}

export type ParcelamentoInput = {
  descricao: string;
  valorParcela: number;
  data: string; // yyyy-MM-dd da primeira parcela
  parcelas: number;
  accountId: string;
  categoryId?: string | null;
  cardId?: string | null;
  tags: string[];
};

/** Recria as parcelas do grupo com os novos dados, mantendo o mesmo parcelaGrupo. */
export async function updateParcelamento(grupo: string, input: ParcelamentoInput) {
  const { id: userId } = await requireUser();
  const parcelas = Math.max(1, Math.floor(input.parcelas));
  const inicio = dataSP(input.data);
  await validarPosse(userId, {
    accountId: input.accountId,
    categoryId: input.categoryId,
    cardId: input.cardId,
  });

  await db.$transaction([
    db.transaction.deleteMany({ where: { userId, parcelaGrupo: grupo } }),
    db.transaction.createMany({
      data: Array.from({ length: parcelas }, (_, i) => ({
        userId,
        tipo: "despesa",
        valor: input.valorParcela,
        descricao: input.descricao,
        tags: JSON.stringify(input.tags ?? []),
        recorrente: false,
        accountId: input.accountId,
        categoryId: input.categoryId ?? null,
        cardId: input.cardId ?? null,
        data: addMonths(inicio, i),
        parcelaGrupo: grupo,
        parcelaNum: i + 1,
        parcelaTotal: parcelas,
      })),
    }),
  ]);

  revalidar(userId);
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
  const { id: userId } = await requireUser();
  const cat = await db.category.create({
    data: { ...input, orcamentoMensal: input.orcamentoMensal ?? null, userId },
  });
  revalidar(userId);
  return cat;
}

export async function updateCategoria(id: string, input: CategoriaInput) {
  const { id: userId } = await requireUser();
  await db.category.update({
    where: { id, userId },
    data: { ...input, orcamentoMensal: input.orcamentoMensal ?? null },
  });
  revalidar(userId);
}

export async function deleteCategoria(id: string) {
  const { id: userId } = await requireUser();
  await db.category.delete({ where: { id, userId } });
  revalidar(userId);
}

// ---------- Cartões ----------

export type CartaoInput = {
  nome: string;
  bandeira: string;
  tipo: "debito" | "credito";
  limite?: number | null;
  fechamento?: number | null;
  vencimento?: number | null;
  cor: string;
};

function normalizarCartao(input: CartaoInput) {
  const credito = input.tipo === "credito";
  return {
    nome: input.nome,
    bandeira: input.bandeira,
    tipo: input.tipo,
    cor: input.cor,
    limite: credito ? input.limite ?? 0 : null,
    fechamento: credito ? input.fechamento ?? 1 : 1,
    vencimento: credito ? input.vencimento ?? 1 : 1,
  };
}

export async function createCartao(input: CartaoInput) {
  const { id: userId } = await requireUser();
  await db.card.create({ data: { ...normalizarCartao(input), userId } });
  revalidar(userId);
}

export async function updateCartao(id: string, input: CartaoInput) {
  const { id: userId } = await requireUser();
  await db.card.update({ where: { id, userId }, data: normalizarCartao(input) });
  revalidar(userId);
}

export async function deleteCartao(id: string) {
  const { id: userId } = await requireUser();
  await db.card.delete({ where: { id, userId } });
  revalidar(userId);
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
  const { id: userId } = await requireUser();
  await db.subscription.create({ data: { ...input, userId } });
  revalidar(userId);
}

export async function updateAssinatura(id: string, input: AssinaturaInput) {
  const { id: userId } = await requireUser();
  const atual = await db.subscription.findFirst({ where: { id, userId } });
  await db.subscription.update({
    where: { id, userId },
    data: {
      ...input,
      valorAnterior:
        atual && atual.valor !== input.valor ? atual.valor : atual?.valorAnterior,
    },
  });
  revalidar(userId);
}

export async function deleteAssinatura(id: string) {
  const { id: userId } = await requireUser();
  const s = await db.subscription.findFirst({ where: { id, userId } });
  await db.subscription.delete({ where: { id, userId } });
  revalidar(userId);
  return s;
}

export async function restoreAssinatura(dados: AssinaturaInput) {
  const { id: userId } = await requireUser();
  await db.subscription.create({ data: { ...dados, userId } });
  revalidar(userId);
}
