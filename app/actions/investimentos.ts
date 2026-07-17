"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

function revalidar() {
  revalidatePath("/investimentos");
  revalidatePath("/");
}

function dataSP(dia: string): Date {
  return new Date(`${dia}T12:00:00-03:00`);
}

export type AtivoInput = {
  nome: string;
  classe: string;
  instituicao: string;
  cor: string;
};

export async function createAsset(input: AtivoInput) {
  await db.asset.create({ data: input });
  revalidar();
}

export async function updateAsset(id: string, input: AtivoInput) {
  await db.asset.update({ where: { id }, data: input });
  revalidar();
}

export async function deleteAsset(id: string) {
  const ativo = await db.asset.findUnique({
    where: { id },
    include: { movements: true },
  });
  await db.asset.delete({ where: { id } });
  revalidar();
  return ativo;
}

export async function restoreAsset(dados: {
  nome: string;
  classe: string;
  instituicao: string;
  cor: string;
  movements: { tipo: string; valor: number; data: Date; nota: string | null }[];
}) {
  await db.asset.create({
    data: {
      nome: dados.nome,
      classe: dados.classe,
      instituicao: dados.instituicao,
      cor: dados.cor,
      movements: { create: dados.movements },
    },
  });
  revalidar();
}

export type MovimentoInput = {
  assetId: string;
  tipo: "aporte" | "resgate" | "atualizacao";
  valor: number;
  data: string; // yyyy-MM-dd
  nota?: string | null;
};

export async function createMovement(input: MovimentoInput) {
  await db.assetMovement.create({
    data: {
      assetId: input.assetId,
      tipo: input.tipo,
      valor: input.valor,
      data: dataSP(input.data),
      nota: input.nota?.trim() || null,
    },
  });
  revalidar();
}

export async function deleteMovement(id: string) {
  const mov = await db.assetMovement.findUnique({ where: { id } });
  await db.assetMovement.delete({ where: { id } });
  revalidar();
  return mov;
}

export async function restoreMovement(dados: {
  assetId: string;
  tipo: string;
  valor: number;
  data: Date;
  nota: string | null;
}) {
  await db.assetMovement.create({ data: dados });
  revalidar();
}
