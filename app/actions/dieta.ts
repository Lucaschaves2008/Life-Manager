"use server";

import { revalidatePath, revalidateTag } from "@/lib/cache-revalidate";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { tagUsuario } from "@/lib/cache-tags";
import { spEndOfDay, spStartOfDay } from "@/lib/dates";
import { marcarDiaAtivo } from "@/lib/streak";
import { parseJSON } from "@/lib/utils";
import { erroCoerenciaMacros } from "@/lib/data/dieta-calc";
import type { EscolhaLog, ExtraLog } from "@/lib/data/dieta";

const MAX_OPCOES = 4;

// Toda mutação deste módulo escreve só em tabelas de dieta → uma tag basta.
// /checklist também entra porque as refeições do dia aparecem lá como itens
// (ver refeicoesDoDiaChecklist), lendo o mesmo DietDayLog.
function revalidar(userId: string) {
  revalidateTag(tagUsuario(userId, "dieta"));
  revalidatePath("/dieta");
  revalidatePath("/checklist");
  revalidatePath("/");
}

function somarDias(base: Date, dias: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + dias);
  return d;
}

function dataSP(dia: string): Date {
  return new Date(`${dia}T12:00:00-03:00`);
}

/** Pega (ou cria) o diário do dia. */
async function logDoDia(userId: string, dia: string) {
  const data = dataSP(dia);
  const existente = await db.dietDayLog.findFirst({
    where: { userId, data: { gte: spStartOfDay(data), lte: spEndOfDay(data) } },
  });
  if (existente) return existente;
  return db.dietDayLog.create({ data: { data: spStartOfDay(data), userId } });
}

// ---------- Diário ----------

export async function toggleRefeicaoCumprida(dia: string, mealId: string) {
  const { id: userId } = await requireUser();
  const log = await logDoDia(userId, dia);
  const atuais = parseJSON<string[]>(log.refeicoesCumpridas, []);
  const escolhas = parseJSON<EscolhaLog[]>(log.escolhas, []);
  let proximas: string[];
  let proximasEscolhas = escolhas;
  if (atuais.includes(mealId)) {
    // desmarcar: some da lista de cumpridas E limpa a opção escolhida
    proximas = atuais.filter((id) => id !== mealId);
    proximasEscolhas = escolhas.filter((e) => e.mealId !== mealId);
  } else {
    const meal = await db.meal.findFirst({
      where: { id: mealId, userId },
      select: { id: true },
    });
    // Refeição já excluída (UI defasada): no-op + revalidate corrige a tela.
    if (!meal) {
      revalidar(userId);
      return;
    }
    proximas = [...atuais, mealId];
    await marcarDiaAtivo(userId, dia); // marcar refeição conquista o dia
  }

  await db.dietDayLog.update({
    where: { id: log.id, userId },
    data: {
      refeicoesCumpridas: JSON.stringify(proximas),
      escolhas: JSON.stringify(proximasEscolhas),
    },
  });
  revalidar(userId);
}

/**
 * Registra qual opção o usuário comeu na refeição, no dia. Marca a refeição
 * como cumprida automaticamente. Passar optionId null desfaz a escolha (e
 * desmarca a refeição). Valida propriedade da opção.
 */
export async function escolherOpcao(
  dia: string,
  mealId: string,
  optionId: string | null
) {
  const { id: userId } = await requireUser();
  const log = await logDoDia(userId, dia);
  const cumpridas = parseJSON<string[]>(log.refeicoesCumpridas, []);
  const escolhas = parseJSON<EscolhaLog[]>(log.escolhas, []);

  if (optionId === null) {
    await db.dietDayLog.update({
      where: { id: log.id, userId },
      data: {
        refeicoesCumpridas: JSON.stringify(cumpridas.filter((id) => id !== mealId)),
        escolhas: JSON.stringify(escolhas.filter((e) => e.mealId !== mealId)),
      },
    });
    revalidar(userId);
    return;
  }

  const opcao = await db.mealOption.findFirst({
    where: { id: optionId, mealId, userId },
    select: { id: true },
  });
  // Opção/refeição sumiu (UI defasada): no-op + revalidate corrige a tela.
  if (!opcao) {
    revalidar(userId);
    return;
  }

  const proximasEscolhas = [
    ...escolhas.filter((e) => e.mealId !== mealId),
    { mealId, optionId },
  ];
  const proximasCumpridas = cumpridas.includes(mealId)
    ? cumpridas
    : [...cumpridas, mealId];

  await db.dietDayLog.update({
    where: { id: log.id, userId },
    data: {
      refeicoesCumpridas: JSON.stringify(proximasCumpridas),
      escolhas: JSON.stringify(proximasEscolhas),
    },
  });
  revalidar(userId);
}

/**
 * Apaga a refeição SÓ neste dia: ela some do checklist de hoje mas continua na
 * dieta e volta amanhã (o equivalente ao "não fazer hoje" da rotina). Se já
 * estava marcada, desmarca junto — refeição que não existe hoje não pode
 * continuar contando como cumprida em metas e desafios.
 */
export async function pularRefeicaoHoje(dia: string, mealId: string) {
  const { id: userId } = await requireUser();
  const log = await logDoDia(userId, dia);
  const puladas = parseJSON<string[]>(log.refeicoesPuladas, []);
  if (puladas.includes(mealId)) return;

  const cumpridas = parseJSON<string[]>(log.refeicoesCumpridas, []);
  const escolhas = parseJSON<EscolhaLog[]>(log.escolhas, []);

  await db.dietDayLog.update({
    where: { id: log.id, userId },
    data: {
      refeicoesPuladas: JSON.stringify([...puladas, mealId]),
      refeicoesCumpridas: JSON.stringify(cumpridas.filter((id) => id !== mealId)),
      escolhas: JSON.stringify(escolhas.filter((e) => e.mealId !== mealId)),
    },
  });
  revalidar(userId);
}

/** Desfaz o "apagar só hoje" — a refeição volta para o checklist do dia. */
export async function restaurarRefeicaoHoje(dia: string, mealId: string) {
  const { id: userId } = await requireUser();
  const log = await logDoDia(userId, dia);
  const puladas = parseJSON<string[]>(log.refeicoesPuladas, []);
  if (!puladas.includes(mealId)) return;

  await db.dietDayLog.update({
    where: { id: log.id, userId },
    data: { refeicoesPuladas: JSON.stringify(puladas.filter((id) => id !== mealId)) },
  });
  revalidar(userId);
}

export async function addExtra(dia: string, extra: ExtraLog) {
  const erro = erroCoerenciaMacros(extra);
  if (erro) throw new Error(erro);
  const { id: userId } = await requireUser();
  const log = await logDoDia(userId, dia);
  const extras = parseJSON<ExtraLog[]>(log.extras, []);
  await db.dietDayLog.update({
    where: { id: log.id, userId },
    data: { extras: JSON.stringify([...extras, extra]) },
  });
  revalidar(userId);
}

export async function removeExtra(dia: string, index: number) {
  const { id: userId } = await requireUser();
  const log = await logDoDia(userId, dia);
  const extras = parseJSON<ExtraLog[]>(log.extras, []);
  await db.dietDayLog.update({
    where: { id: log.id, userId },
    data: { extras: JSON.stringify(extras.filter((_, i) => i !== index)) },
  });
  revalidar(userId);
}

export async function setAgua(dia: string, aguaMl: number) {
  const { id: userId } = await requireUser();
  const log = await logDoDia(userId, dia);
  await db.dietDayLog.update({
    where: { id: log.id, userId },
    data: { aguaMl: Math.max(0, aguaMl) },
  });
  revalidar(userId);
}

export async function setNotas(dia: string, notas: string) {
  const { id: userId } = await requireUser();
  const log = await logDoDia(userId, dia);
  await db.dietDayLog.update({
    where: { id: log.id, userId },
    data: { notas: notas.trim() || null },
  });
  revalidar(userId);
}

// ---------- Dietas ----------

export type DietaInput = {
  nome: string;
  metaKcal: number;
  metaProt: number;
  metaCarb: number;
  metaGord: number;
};

function validarMetasDieta(input: DietaInput) {
  if (!(input.metaKcal > 0)) throw new Error("Meta de kcal deve ser maior que zero.");
  if (input.metaProt < 0 || input.metaCarb < 0 || input.metaGord < 0) {
    throw new Error("Metas de macros não podem ser negativas.");
  }
}

export async function createDieta(input: DietaInput) {
  const { id: userId } = await requireUser();
  validarMetasDieta(input);
  await db.diet.create({ data: { ...input, userId } });
  revalidar(userId);
}

export async function updateDieta(id: string, input: DietaInput) {
  const { id: userId } = await requireUser();
  validarMetasDieta(input);
  await db.diet.update({ where: { id, userId }, data: input });
  revalidar(userId);
}

export async function ativarDieta(id: string) {
  const { id: userId } = await requireUser();
  await db.$transaction([
    db.diet.updateMany({ where: { userId }, data: { ativa: false } }),
    db.diet.update({ where: { id, userId }, data: { ativa: true } }),
  ]);
  revalidar(userId);
}

export async function deleteDieta(id: string) {
  const { id: userId } = await requireUser();
  await db.diet.delete({ where: { id, userId } });
  revalidar(userId);
}

export async function duplicarDieta(id: string) {
  const { id: userId } = await requireUser();
  const dieta = await db.diet.findFirst({
    where: { id, userId },
    include: {
      meals: {
        orderBy: { ordem: "asc" },
        include: {
          options: { orderBy: { ordem: "asc" }, include: { items: true } },
        },
      },
    },
  });
  if (!dieta) return;

  // Cria a dieta e as refeições primeiro; depois opções e itens em passos, pois
  // MealItem precisa de mealId + optionId concretos (não dá pra aninhar tudo).
  const nova = await db.diet.create({
    data: {
      userId,
      nome: `${dieta.nome} (cópia)`,
      ativa: false,
      metaKcal: dieta.metaKcal,
      metaProt: dieta.metaProt,
      metaCarb: dieta.metaCarb,
      metaGord: dieta.metaGord,
    },
  });

  for (const m of dieta.meals) {
    const novaMeal = await db.meal.create({
      data: { userId, dietId: nova.id, nome: m.nome, horario: m.horario, ordem: m.ordem },
    });
    for (const o of m.options) {
      const novaOpcao = await db.mealOption.create({
        data: { userId, mealId: novaMeal.id, nome: o.nome, ordem: o.ordem },
      });
      if (o.items.length > 0) {
        await db.mealItem.createMany({
          data: o.items.map((i) => ({
            userId,
            mealId: novaMeal.id,
            optionId: novaOpcao.id,
            foodId: i.foodId,
            quantidade: i.quantidade,
            unidade: i.unidade,
          })),
        });
      }
    }
  }
  revalidar(userId);
}

// ---------- Refeições ----------

export async function createRefeicao(dietId: string, nome: string, horario: string) {
  const { id: userId } = await requireUser();
  const dieta = await db.diet.findFirst({
    where: { id: dietId, userId },
    select: { id: true },
  });
  if (!dieta) throw new Error("Recurso não encontrado.");
  const total = await db.meal.count({ where: { userId, dietId } });
  // Toda refeição nasce com a "Opção 1" pronta, pra o fluxo de itens funcionar
  // sem obrigar o usuário a criar opção antes.
  await db.meal.create({
    data: {
      dietId,
      nome,
      horario: horario || null,
      ordem: total,
      userId,
      options: { create: { userId, nome: "Opção 1", ordem: 0 } },
    },
  });
  revalidar(userId);
}

export async function updateRefeicao(id: string, nome: string, horario: string) {
  const { id: userId } = await requireUser();
  await db.meal.update({
    where: { id, userId },
    data: { nome, horario: horario || null },
  });
  revalidar(userId);
}

export async function deleteRefeicao(id: string) {
  const { id: userId } = await requireUser();
  await db.meal.delete({ where: { id, userId } });
  revalidar(userId);
}

// ---------- Opções de refeição ----------

export async function createOption(mealId: string, nome: string) {
  const { id: userId } = await requireUser();
  const meal = await db.meal.findFirst({
    where: { id: mealId, userId },
    select: { id: true, _count: { select: { options: true } } },
  });
  if (!meal) throw new Error("Recurso não encontrado.");
  if (meal._count.options >= MAX_OPCOES) {
    throw new Error(`Máximo de ${MAX_OPCOES} opções por refeição.`);
  }
  const ordem = meal._count.options;
  const opcao = await db.mealOption.create({
    data: { mealId, nome: nome.trim() || `Opção ${ordem + 1}`, ordem, userId },
  });
  revalidar(userId);
  return opcao.id;
}

export async function updateOption(id: string, nome: string) {
  const { id: userId } = await requireUser();
  await db.mealOption.update({
    where: { id, userId },
    data: { nome: nome.trim() || "Opção" },
  });
  revalidar(userId);
}

export async function deleteOption(id: string) {
  const { id: userId } = await requireUser();
  await db.mealOption.delete({ where: { id, userId } });
  revalidar(userId);
}

/** Duplica uma opção (com seus itens) dentro da mesma refeição, se couber. */
export async function duplicarOption(id: string) {
  const { id: userId } = await requireUser();
  const opcao = await db.mealOption.findFirst({
    where: { id, userId },
    include: { items: true, meal: { select: { _count: { select: { options: true } } } } },
  });
  if (!opcao) return;
  if (opcao.meal._count.options >= MAX_OPCOES) {
    throw new Error(`Máximo de ${MAX_OPCOES} opções por refeição.`);
  }
  await db.mealOption.create({
    data: {
      userId,
      mealId: opcao.mealId,
      nome: `${opcao.nome} (cópia)`,
      ordem: opcao.meal._count.options,
      items: {
        create: opcao.items.map((i) => ({
          userId,
          mealId: opcao.mealId,
          foodId: i.foodId,
          quantidade: i.quantidade,
          unidade: i.unidade,
        })),
      },
    },
  });
  revalidar(userId);
}

// ---------- Itens (dentro de uma opção) ----------

export async function addItem(
  optionId: string,
  foodId: string,
  quantidade: number,
  unidade: string
) {
  const { id: userId } = await requireUser();
  const [option, food] = await Promise.all([
    db.mealOption.findFirst({
      where: { id: optionId, userId },
      select: { id: true, mealId: true },
    }),
    db.food.findFirst({ where: { id: foodId, userId }, select: { id: true } }),
  ]);
  if (!option || !food) throw new Error("Recurso não encontrado.");
  if (!(quantidade > 0)) throw new Error("Quantidade deve ser maior que zero.");
  await db.mealItem.create({
    data: { optionId, mealId: option.mealId, foodId, quantidade, unidade, userId },
  });
  revalidar(userId);
}

export async function deleteItem(id: string) {
  const { id: userId } = await requireUser();
  await db.mealItem.delete({ where: { id, userId } });
  revalidar(userId);
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

function validarAlimento(input: AlimentoInput) {
  const { kcal100, prot100, carb100, gord100 } = input;
  if (kcal100 == null || prot100 == null || carb100 == null || gord100 == null) return;
  const erro = erroCoerenciaMacros({ kcal: kcal100, prot: prot100, carb: carb100, gord: gord100 });
  if (erro) throw new Error(`${erro} (valores por 100 g)`);
}

export async function createAlimento(input: AlimentoInput) {
  validarAlimento(input);
  const { id: userId } = await requireUser();
  await db.food.create({ data: { ...input, userId } });
  revalidar(userId);
}

export async function updateAlimento(id: string, input: AlimentoInput) {
  validarAlimento(input);
  const { id: userId } = await requireUser();
  await db.food.update({ where: { id, userId }, data: input });
  revalidar(userId);
}

export async function deleteAlimento(id: string) {
  const { id: userId } = await requireUser();
  const food = await db.food.findFirst({ where: { id, userId } });
  await db.food.delete({ where: { id, userId } });
  revalidar(userId);
  return food;
}

export async function restoreAlimento(dados: AlimentoInput) {
  const { id: userId } = await requireUser();
  await db.food.create({ data: { ...dados, userId } });
  revalidar(userId);
}

// ---------- Peso ----------

export type PesoInput = {
  data: string;
  pesoKg: number;
  cintura?: number | null;
  braco?: number | null;
  percentualGordura?: number | null;
  massaMuscular?: number | null;
  aguaCorporal?: number | null;
  massaOssea?: number | null;
  gorduraVisceral?: number | null;
  tmb?: number | null;
};

export async function createPeso(input: PesoInput) {
  const { id: userId } = await requireUser();
  await db.weightLog.create({
    data: {
      data: dataSP(input.data),
      pesoKg: input.pesoKg,
      cintura: input.cintura ?? null,
      braco: input.braco ?? null,
      percentualGordura: input.percentualGordura ?? null,
      massaMuscular: input.massaMuscular ?? null,
      aguaCorporal: input.aguaCorporal ?? null,
      massaOssea: input.massaOssea ?? null,
      gorduraVisceral: input.gorduraVisceral ?? null,
      tmb: input.tmb ?? null,
      userId,
    },
  });

  const perfil = await db.profile.findUnique({
    where: { id: userId },
    select: { revisarPesoACada: true },
  });
  if (perfil?.revisarPesoACada) {
    await db.profile.update({
      where: { id: userId },
      data: { proximaRevisaoPeso: somarDias(dataSP(input.data), perfil.revisarPesoACada) },
    });
  }

  revalidar(userId);
}

/** Configura (ou desliga, com null) o lembrete pessoal de atualizar métricas de peso. */
export async function configurarLembretePeso(revisarACada: number | null) {
  const { id: userId } = await requireUser();
  await db.profile.update({
    where: { id: userId },
    data: {
      revisarPesoACada: revisarACada,
      proximaRevisaoPeso: revisarACada ? somarDias(new Date(), revisarACada) : null,
    },
  });
  revalidar(userId);
}

export async function deletePeso(id: string) {
  const { id: userId } = await requireUser();
  const registro = await db.weightLog.findFirst({ where: { id, userId } });
  await db.weightLog.delete({ where: { id, userId } });
  revalidar(userId);
  return registro;
}

export async function restorePeso(dados: {
  data: Date;
  pesoKg: number;
  cintura: number | null;
  braco: number | null;
  percentualGordura?: number | null;
  massaMuscular?: number | null;
  aguaCorporal?: number | null;
  massaOssea?: number | null;
  gorduraVisceral?: number | null;
  tmb?: number | null;
}) {
  const { id: userId } = await requireUser();
  await db.weightLog.create({ data: { ...dados, userId } });
  revalidar(userId);
}
