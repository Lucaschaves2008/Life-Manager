"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { spEndOfDay, spStartOfDay } from "@/lib/dates";
import { parseJSON } from "@/lib/utils";
import type { ExtraLog } from "@/lib/data/dieta";

function revalidar() {
  revalidatePath("/dieta");
  revalidatePath("/");
}

function dataSP(dia: string): Date {
  return new Date(`${dia}T12:00:00-03:00`);
}

/** Pega (ou cria) o diário do dia. */
async function logDoDia(dia: string) {
  const data = dataSP(dia);
  const existente = await db.dietDayLog.findFirst({
    where: { data: { gte: spStartOfDay(data), lte: spEndOfDay(data) } },
  });
  if (existente) return existente;
  return db.dietDayLog.create({ data: { data: spStartOfDay(data) } });
}

// ---------- Diário ----------

export async function toggleRefeicaoCumprida(dia: string, mealId: string) {
  const log = await logDoDia(dia);
  const atuais = parseJSON<string[]>(log.refeicoesCumpridas, []);
  const proximas = atuais.includes(mealId)
    ? atuais.filter((id) => id !== mealId)
    : [...atuais, mealId];

  await db.dietDayLog.update({
    where: { id: log.id },
    data: { refeicoesCumpridas: JSON.stringify(proximas) },
  });
  revalidar();
}

export async function addExtra(dia: string, extra: ExtraLog) {
  const log = await logDoDia(dia);
  const extras = parseJSON<ExtraLog[]>(log.extras, []);
  await db.dietDayLog.update({
    where: { id: log.id },
    data: { extras: JSON.stringify([...extras, extra]) },
  });
  revalidar();
}

export async function removeExtra(dia: string, index: number) {
  const log = await logDoDia(dia);
  const extras = parseJSON<ExtraLog[]>(log.extras, []);
  await db.dietDayLog.update({
    where: { id: log.id },
    data: { extras: JSON.stringify(extras.filter((_, i) => i !== index)) },
  });
  revalidar();
}

export async function setAgua(dia: string, aguaMl: number) {
  const log = await logDoDia(dia);
  await db.dietDayLog.update({
    where: { id: log.id },
    data: { aguaMl: Math.max(0, aguaMl) },
  });
  revalidar();
}

export async function setNotas(dia: string, notas: string) {
  const log = await logDoDia(dia);
  await db.dietDayLog.update({
    where: { id: log.id },
    data: { notas: notas.trim() || null },
  });
  revalidar();
}

// ---------- Dietas ----------

export type DietaInput = {
  nome: string;
  metaKcal: number;
  metaProt: number;
  metaCarb: number;
  metaGord: number;
};

export async function createDieta(input: DietaInput) {
  await db.diet.create({ data: input });
  revalidar();
}

export async function updateDieta(id: string, input: DietaInput) {
  await db.diet.update({ where: { id }, data: input });
  revalidar();
}

export async function ativarDieta(id: string) {
  await db.$transaction([
    db.diet.updateMany({ data: { ativa: false } }),
    db.diet.update({ where: { id }, data: { ativa: true } }),
  ]);
  revalidar();
}

export async function deleteDieta(id: string) {
  await db.diet.delete({ where: { id } });
  revalidar();
}

export async function duplicarDieta(id: string) {
  const dieta = await db.diet.findUnique({
    where: { id },
    include: { meals: { include: { items: true }, orderBy: { ordem: "asc" } } },
  });
  if (!dieta) return;

  await db.diet.create({
    data: {
      nome: `${dieta.nome} (cópia)`,
      ativa: false,
      metaKcal: dieta.metaKcal,
      metaProt: dieta.metaProt,
      metaCarb: dieta.metaCarb,
      metaGord: dieta.metaGord,
      meals: {
        create: dieta.meals.map((m) => ({
          nome: m.nome,
          horario: m.horario,
          ordem: m.ordem,
          items: {
            create: m.items.map((i) => ({
              quantidade: i.quantidade,
              unidade: i.unidade,
              foodId: i.foodId,
            })),
          },
        })),
      },
    },
  });
  revalidar();
}

// ---------- Refeições e itens ----------

export async function createRefeicao(dietId: string, nome: string, horario: string) {
  const total = await db.meal.count({ where: { dietId } });
  await db.meal.create({
    data: { dietId, nome, horario: horario || null, ordem: total },
  });
  revalidar();
}

export async function updateRefeicao(id: string, nome: string, horario: string) {
  await db.meal.update({ where: { id }, data: { nome, horario: horario || null } });
  revalidar();
}

export async function deleteRefeicao(id: string) {
  await db.meal.delete({ where: { id } });
  revalidar();
}

export async function addItem(
  mealId: string,
  foodId: string,
  quantidade: number,
  unidade: string
) {
  await db.mealItem.create({ data: { mealId, foodId, quantidade, unidade } });
  revalidar();
}

export async function deleteItem(id: string) {
  await db.mealItem.delete({ where: { id } });
  revalidar();
}

// ---------- Alimentos ----------

export type AlimentoInput = {
  nome: string;
  kcal100: number | null;
  prot100: number | null;
  carb100: number | null;
  gord100: number | null;
  porcaoNome: string | null;
  porcaoG: number | null;
};

export async function createAlimento(input: AlimentoInput) {
  await db.food.create({ data: input });
  revalidar();
}

export async function updateAlimento(id: string, input: AlimentoInput) {
  await db.food.update({ where: { id }, data: input });
  revalidar();
}

export async function deleteAlimento(id: string) {
  const food = await db.food.findUnique({ where: { id } });
  await db.food.delete({ where: { id } });
  revalidar();
  return food;
}

export async function restoreAlimento(dados: AlimentoInput) {
  await db.food.create({ data: dados });
  revalidar();
}

// ---------- Peso ----------

export type PesoInput = {
  data: string;
  pesoKg: number;
  cintura?: number | null;
  braco?: number | null;
};

export async function createPeso(input: PesoInput) {
  await db.weightLog.create({
    data: {
      data: dataSP(input.data),
      pesoKg: input.pesoKg,
      cintura: input.cintura ?? null,
      braco: input.braco ?? null,
    },
  });
  revalidar();
}

export async function deletePeso(id: string) {
  const registro = await db.weightLog.findUnique({ where: { id } });
  await db.weightLog.delete({ where: { id } });
  revalidar();
  return registro;
}

export async function restorePeso(dados: {
  data: Date;
  pesoKg: number;
  cintura: number | null;
  braco: number | null;
}) {
  await db.weightLog.create({ data: dados });
  revalidar();
}
