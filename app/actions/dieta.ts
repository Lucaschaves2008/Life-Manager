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

/**
 * Copia a dieta com seus horários e vínculos. As refeições NÃO são duplicadas:
 * a cópia aponta pras mesmas da biblioteca — é o ponto da biblioteca. Editar o
 * preparo da panqueca conserta as duas dietas de uma vez.
 */
export async function duplicarDieta(id: string) {
  const { id: userId } = await requireUser();
  const dieta = await db.diet.findFirst({
    where: { id, userId },
    include: {
      meals: {
        orderBy: { ordem: "asc" },
        include: { options: { orderBy: { ordem: "asc" } } },
      },
    },
  });
  if (!dieta) return;

  await db.diet.create({
    data: {
      userId,
      nome: `${dieta.nome} (cópia)`,
      ativa: false,
      metaKcal: dieta.metaKcal,
      metaProt: dieta.metaProt,
      metaCarb: dieta.metaCarb,
      metaGord: dieta.metaGord,
      meals: {
        create: dieta.meals.map((m) => ({
          userId,
          nome: m.nome,
          horario: m.horario,
          ordem: m.ordem,
          options: {
            create: m.options.map((o) => ({
              userId,
              recipeId: o.recipeId,
              ordem: o.ordem,
            })),
          },
        })),
      },
    },
  });
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
  // Nasce vazio: o horário existe, e o usuário pendura nele as refeições da
  // biblioteca (uma só, ou até MAX_OPCOES alternativas pra escolher no dia).
  await db.meal.create({
    data: { dietId, nome, horario: horario || null, ordem: total, userId },
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

// ---------- Vínculo refeição ↔ horário da dieta ----------

/**
 * Pendura uma refeição da biblioteca num horário da dieta. Nada é copiado: o
 * vínculo aponta pra receita, então a mesma panqueca pode estar no bulking e,
 * meses depois, na dieta de perda, sem recadastrar.
 */
export async function vincularReceita(mealId: string, recipeId: string) {
  const { id: userId } = await requireUser();
  const [meal, receita] = await Promise.all([
    db.meal.findFirst({
      where: { id: mealId, userId },
      select: { id: true, _count: { select: { options: true } } },
    }),
    db.recipe.findFirst({ where: { id: recipeId, userId }, select: { id: true } }),
  ]);
  if (!meal || !receita) throw new Error("Recurso não encontrado.");
  if (meal._count.options >= MAX_OPCOES) {
    throw new Error(`Máximo de ${MAX_OPCOES} opções por refeição.`);
  }
  const repetida = await db.mealOption.findFirst({
    where: { mealId, recipeId, userId },
    select: { id: true },
  });
  if (repetida) throw new Error("Essa refeição já está nesse horário.");

  await db.mealOption.create({
    data: { mealId, recipeId, ordem: meal._count.options, userId },
  });
  revalidar(userId);
}

/** Tira a refeição do horário. A receita continua na biblioteca. */
export async function desvincularReceita(optionId: string) {
  const { id: userId } = await requireUser();
  await db.mealOption.delete({ where: { id: optionId, userId } });
  revalidar(userId);
}

// ---------- Biblioteca de refeições ----------

export type IngredienteInput = {
  foodId: string;
  /** null = "a gosto" (sal, tempero, manteiga da frigideira). */
  quantidade: number | null;
  unidade: string;
};

export type ReceitaInput = {
  nome: string;
  /** modo de preparo, texto livre */
  descricao: string | null;
  /** null = macros somados dos ingredientes */
  macrosManuais: { kcal: number; prot: number; carb: number; gord: number } | null;
  ingredientes: IngredienteInput[];
};

async function validarReceita(userId: string, input: ReceitaInput) {
  if (!input.nome.trim()) throw new Error("A refeição precisa de um nome.");
  if (input.macrosManuais) {
    const erro = erroCoerenciaMacros(input.macrosManuais);
    if (erro) throw new Error(erro);
  }
  for (const i of input.ingredientes) {
    if (i.quantidade != null && !(i.quantidade > 0)) {
      throw new Error("Quantidade deve ser maior que zero (ou vazia, para “a gosto”).");
    }
  }
  // Um alimento de outro usuário não pode entrar na receita.
  const ids = [...new Set(input.ingredientes.map((i) => i.foodId))];
  if (ids.length > 0) {
    const validos = await db.food.count({ where: { id: { in: ids }, userId } });
    if (validos !== ids.length) throw new Error("Recurso não encontrado.");
  }
}

function dadosDaReceita(userId: string, input: ReceitaInput) {
  return {
    nome: input.nome.trim(),
    descricao: input.descricao?.trim() || null,
    kcalManual: input.macrosManuais?.kcal ?? null,
    protManual: input.macrosManuais?.prot ?? null,
    carbManual: input.macrosManuais?.carb ?? null,
    gordManual: input.macrosManuais?.gord ?? null,
    itens: {
      create: input.ingredientes.map((i, ordem) => ({
        userId,
        foodId: i.foodId,
        quantidade: i.quantidade,
        unidade: i.unidade,
        ordem,
      })),
    },
  };
}

export async function createReceita(input: ReceitaInput) {
  const { id: userId } = await requireUser();
  await validarReceita(userId, input);
  const receita = await db.recipe.create({
    data: { userId, ...dadosDaReceita(userId, input) },
  });
  revalidar(userId);
  return receita.id;
}

/**
 * Salva a refeição inteira: os ingredientes são trocados de uma vez (apaga e
 * recria) porque a tela edita a lista toda, não item a item — e assim a ordem
 * digitada é a ordem gravada.
 */
export async function updateReceita(id: string, input: ReceitaInput) {
  const { id: userId } = await requireUser();
  await validarReceita(userId, input);
  const existente = await db.recipe.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existente) throw new Error("Recurso não encontrado.");

  const { itens, ...campos } = dadosDaReceita(userId, input);
  await db.$transaction([
    db.recipeItem.deleteMany({ where: { recipeId: id, userId } }),
    db.recipe.update({ where: { id, userId }, data: { ...campos, itens } }),
  ]);
  revalidar(userId);
}

/** Apaga a refeição da biblioteca — sai junto das dietas onde estava. */
export async function deleteReceita(id: string) {
  const { id: userId } = await requireUser();
  await db.recipe.delete({ where: { id, userId } });
  revalidar(userId);
}

export async function duplicarReceita(id: string) {
  const { id: userId } = await requireUser();
  const receita = await db.recipe.findFirst({
    where: { id, userId },
    include: { itens: { orderBy: { ordem: "asc" } } },
  });
  if (!receita) return;
  await db.recipe.create({
    data: {
      userId,
      nome: `${receita.nome} (cópia)`,
      descricao: receita.descricao,
      kcalManual: receita.kcalManual,
      protManual: receita.protManual,
      carbManual: receita.carbManual,
      gordManual: receita.gordManual,
      itens: {
        create: receita.itens.map((i) => ({
          userId,
          foodId: i.foodId,
          quantidade: i.quantidade,
          unidade: i.unidade,
          ordem: i.ordem,
        })),
      },
    },
  });
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

/** Devolve o id — é ele que a tela de refeição usa pra já pôr o alimento
 * recém-criado como ingrediente, sem uma segunda ida ao servidor. */
export async function createAlimento(input: AlimentoInput) {
  validarAlimento(input);
  const { id: userId } = await requireUser();
  const food = await db.food.create({ data: { ...input, userId } });
  revalidar(userId);
  return food.id;
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
