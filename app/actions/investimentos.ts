"use server";

import { revalidatePath, revalidateTag } from "@/lib/cache-revalidate";
import { db } from "@/lib/db";
import { apenas } from "@/lib/utils";
import { exigirCentavos } from "@/lib/money";
import { requireUser } from "@/lib/auth";
import { tagUsuario } from "@/lib/cache-tags";
import { getContaAtiva } from "@/lib/conta-ativa";

function revalidar(userId: string, contaFinanceiraId: string) {
  revalidatePath("/investimentos");
  revalidatePath("/");
  // derruba as leituras cacheadas do módulo (carteira, resumos, revisões)
  revalidateTag(tagUsuario(contaFinanceiraId, "investimentos"));
  // leituras por usuário (sino de revisões, /metas) usam a tag do userId
  revalidateTag(tagUsuario(userId, "investimentos"));
}

function dataSP(dia: string): Date {
  return new Date(`${dia}T12:00:00-03:00`);
}

function somarDias(base: Date, dias: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + dias);
  return d;
}

export type AtivoInput = {
  nome: string;
  classe: string;
  instituicao: string;
  cor: string;
  diaAporte?: number | null;
  revisarACada?: number | null;
};

const CAMPOS_ATIVO = {
  nome: true, classe: true, instituicao: true, cor: true, diaAporte: true, revisarACada: true,
} as const;

const TIPOS_MOVIMENTO = ["aporte", "resgate", "atualizacao", "dividendo"];

/** Movimento vindo do cliente: só as colunas dele, tipo conhecido e valor ≥ 0 (atualização pode zerar). */
function camposMovimento<M extends { tipo: string; valor: number; data: Date; nota: string | null }>(m: M) {
  if (!TIPOS_MOVIMENTO.includes(m.tipo)) throw new Error("Tipo de movimento inválido.");
  exigirCentavos(m.valor, 0);
  return { tipo: m.tipo, valor: m.valor, data: m.data, nota: m.nota };
}

export async function createAsset(input: AtivoInput) {
  const { id: userId } = await requireUser();
  const { id: contaFinanceiraId } = await getContaAtiva(userId);
  const revisarACada = input.revisarACada ?? null;
  await db.asset.create({
    data: {
      ...apenas(input, CAMPOS_ATIVO),
      diaAporte: input.diaAporte ?? null,
      revisarACada,
      proximaRevisao: revisarACada ? somarDias(new Date(), revisarACada) : null,
      userId,
      contaFinanceiraId,
    },
  });
  revalidar(userId, contaFinanceiraId);
}

export async function updateAsset(id: string, input: AtivoInput) {
  const { id: userId } = await requireUser();
  const { id: contaFinanceiraId } = await getContaAtiva(userId);
  const revisarACada = input.revisarACada ?? null;
  const atual = await db.asset.findFirst({ where: { id, userId, contaFinanceiraId } });
  await db.asset.update({
    where: { id, userId, contaFinanceiraId },
    data: {
      ...apenas(input, CAMPOS_ATIVO),
      diaAporte: input.diaAporte ?? null,
      revisarACada,
      proximaRevisao: !revisarACada
        ? null
        : atual?.revisarACada === revisarACada && atual?.proximaRevisao
        ? atual.proximaRevisao
        : somarDias(new Date(), revisarACada),
    },
  });
  revalidar(userId, contaFinanceiraId);
}

export async function deleteAsset(id: string) {
  const { id: userId } = await requireUser();
  const { id: contaFinanceiraId } = await getContaAtiva(userId);
  const ativo = await db.asset.findFirst({
    where: { id, userId, contaFinanceiraId },
    include: { movements: true },
  });
  await db.asset.delete({ where: { id, userId, contaFinanceiraId } });
  revalidar(userId, contaFinanceiraId);
  return ativo;
}

export async function restoreAsset(dados: {
  nome: string;
  classe: string;
  instituicao: string;
  cor: string;
  diaAporte?: number | null;
  movements: { tipo: string; valor: number; data: Date; nota: string | null }[];
}) {
  const { id: userId } = await requireUser();
  const { id: contaFinanceiraId } = await getContaAtiva(userId);
  await db.asset.create({
    data: {
      nome: dados.nome,
      classe: dados.classe,
      instituicao: dados.instituicao,
      cor: dados.cor,
      diaAporte: dados.diaAporte ?? null,
      userId,
      contaFinanceiraId,
      movements: {
        create: dados.movements.map((m) => ({ ...camposMovimento(m), userId, contaFinanceiraId })),
      },
    },
  });
  revalidar(userId, contaFinanceiraId);
}

export type MovimentoInput = {
  assetId: string;
  tipo: "aporte" | "resgate" | "atualizacao" | "dividendo";
  valor: number;
  data: string; // yyyy-MM-dd
  nota?: string | null;
};

export async function createMovement(input: MovimentoInput) {
  const { id: userId } = await requireUser();
  const { id: contaFinanceiraId } = await getContaAtiva(userId);
  const ativo = await db.asset.findFirst({
    where: { id: input.assetId, userId, contaFinanceiraId },
    select: { id: true, revisarACada: true },
  });
  if (!ativo) throw new Error("Recurso não encontrado.");

  await db.assetMovement.create({
    data: {
      assetId: input.assetId,
      ...camposMovimento({
        tipo: input.tipo,
        valor: input.valor,
        data: dataSP(input.data),
        nota: input.nota?.trim() || null,
      }),
      userId,
      contaFinanceiraId,
    },
  });

  if (input.tipo === "atualizacao" && ativo.revisarACada) {
    await db.asset.update({
      where: { id: ativo.id },
      data: { proximaRevisao: somarDias(dataSP(input.data), ativo.revisarACada) },
    });
  }

  revalidar(userId, contaFinanceiraId);
}

export async function deleteMovement(id: string) {
  const { id: userId } = await requireUser();
  const { id: contaFinanceiraId } = await getContaAtiva(userId);
  const mov = await db.assetMovement.findFirst({ where: { id, userId, contaFinanceiraId } });
  await db.assetMovement.delete({ where: { id, userId, contaFinanceiraId } });
  revalidar(userId, contaFinanceiraId);
  return mov;
}

export async function restoreMovement(dados: {
  assetId: string;
  tipo: string;
  valor: number;
  data: Date;
  nota: string | null;
}) {
  const { id: userId } = await requireUser();
  const { id: contaFinanceiraId } = await getContaAtiva(userId);
  const ativo = await db.asset.findFirst({
    where: { id: dados.assetId, userId, contaFinanceiraId },
    select: { id: true },
  });
  if (!ativo) throw new Error("Recurso não encontrado.");
  await db.assetMovement.create({
    data: { ...camposMovimento(dados), assetId: dados.assetId, userId, contaFinanceiraId },
  });
  revalidar(userId, contaFinanceiraId);
}
