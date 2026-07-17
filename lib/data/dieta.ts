import { subDays } from "date-fns";
import { db } from "@/lib/db";
import { dayKeySP, spEndOfDay, spStartOfDay, toSP } from "@/lib/dates";
import { parseJSON } from "@/lib/utils";

export type Macros = { kcal: number; prot: number; carb: number; gord: number };

export const macrosZero: Macros = { kcal: 0, prot: 0, carb: 0, gord: 0 };

export function somaMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    prot: a.prot + b.prot,
    carb: a.carb + b.carb,
    gord: a.gord + b.gord,
  };
}

type FoodLike = {
  kcal100: number | null;
  prot100: number | null;
  carb100: number | null;
  gord100: number | null;
  porcaoG: number | null;
};

type ItemLike = { quantidade: number; unidade: string; food: FoodLike };

/**
 * Macros de um item: unidade "g" usa a quantidade direto;
 * "porcao" multiplica pela gramagem da porção. Sempre por 100g.
 */
export function macrosDoItem(item: ItemLike): Macros {
  const gramas =
    item.unidade === "porcao"
      ? item.quantidade * (item.food.porcaoG ?? 100)
      : item.quantidade;
  const fator = gramas / 100;
  return {
    kcal: (item.food.kcal100 ?? 0) * fator,
    prot: (item.food.prot100 ?? 0) * fator,
    carb: (item.food.carb100 ?? 0) * fator,
    gord: (item.food.gord100 ?? 0) * fator,
  };
}

export function macrosDaRefeicao(items: ItemLike[]): Macros {
  return items.map(macrosDoItem).reduce(somaMacros, macrosZero);
}

export type ExtraLog = {
  nome: string;
  kcal: number;
  prot: number;
  carb: number;
  gord: number;
};

export type DiaDaDieta = {
  data: string;
  consumido: Macros;
  metas: Macros;
  cumpridas: string[];
  extras: ExtraLog[];
  aguaMl: number;
  metaAguaMl: number;
  notas: string;
  refeicoes: {
    id: string;
    nome: string;
    horario: string | null;
    macros: Macros;
    itens: { id: string; nome: string; quantidade: number; unidade: string }[];
  }[];
  dietaNome: string | null;
};

export async function diaDaDieta(ref: Date = new Date()): Promise<DiaDaDieta> {
  const [dieta, log, metaAgua] = await Promise.all([
    db.diet.findFirst({
      where: { ativa: true },
      include: {
        meals: {
          orderBy: { ordem: "asc" },
          include: { items: { include: { food: true } } },
        },
      },
    }),
    db.dietDayLog.findFirst({
      where: { data: { gte: spStartOfDay(ref), lte: spEndOfDay(ref) } },
    }),
    db.setting.findUnique({ where: { key: "meta_agua_ml" } }),
  ]);

  const cumpridas = parseJSON<string[]>(log?.refeicoesCumpridas ?? "[]", []);
  const extras = parseJSON<ExtraLog[]>(log?.extras ?? "[]", []);

  const refeicoes = (dieta?.meals ?? []).map((meal) => ({
    id: meal.id,
    nome: meal.nome,
    horario: meal.horario,
    macros: macrosDaRefeicao(meal.items),
    itens: meal.items.map((i) => ({
      id: i.id,
      nome: i.food.nome,
      quantidade: i.quantidade,
      unidade: i.unidade,
    })),
  }));

  let consumido = macrosZero;
  for (const r of refeicoes) {
    if (cumpridas.includes(r.id)) consumido = somaMacros(consumido, r.macros);
  }
  for (const e of extras) {
    consumido = somaMacros(consumido, {
      kcal: e.kcal,
      prot: e.prot,
      carb: e.carb,
      gord: e.gord,
    });
  }

  return {
    data: dayKeySP(ref),
    consumido,
    metas: {
      kcal: dieta?.metaKcal ?? 2200,
      prot: dieta?.metaProt ?? 160,
      carb: dieta?.metaCarb ?? 220,
      gord: dieta?.metaGord ?? 60,
    },
    cumpridas,
    extras,
    aguaMl: log?.aguaMl ?? 0,
    metaAguaMl: Number(metaAgua?.value ?? 3000) || 3000,
    notas: log?.notas ?? "",
    refeicoes,
    dietaNome: dieta?.nome ?? null,
  };
}

/** % de refeições cumpridas nos últimos 7 dias. */
export async function aderencia7d(ref: Date = new Date()): Promise<number> {
  const dieta = await db.diet.findFirst({
    where: { ativa: true },
    include: { meals: true },
  });
  if (!dieta || dieta.meals.length === 0) return 0;

  const logs = await db.dietDayLog.findMany({
    where: {
      data: { gte: spStartOfDay(subDays(toSP(ref), 6)), lte: spEndOfDay(ref) },
    },
  });

  const possiveis = dieta.meals.length * 7;
  const feitas = logs.reduce(
    (s, log) => s + parseJSON<string[]>(log.refeicoesCumpridas, []).length,
    0
  );
  return possiveis > 0 ? (feitas / possiveis) * 100 : 0;
}

/** Dias consecutivos com diário preenchido (alguma refeição ou extra). */
export async function streakDieta(ref: Date = new Date()): Promise<number> {
  const logs = await db.dietDayLog.findMany({
    where: { data: { gte: spStartOfDay(subDays(toSP(ref), 120)) } },
  });
  const dias = new Set(
    logs
      .filter(
        (l) =>
          parseJSON<string[]>(l.refeicoesCumpridas, []).length > 0 ||
          parseJSON<ExtraLog[]>(l.extras, []).length > 0
      )
      .map((l) => dayKeySP(l.data))
  );

  let streak = 0;
  for (let i = 0; i < 120; i++) {
    const dia = dayKeySP(subDays(toSP(ref), i));
    if (dias.has(dia)) streak++;
    else if (i > 0) break;
  }
  return streak;
}

export type PesoPonto = {
  label: string;
  peso: number;
  media7: number | null;
  meta: number;
};

export async function evolucaoPeso(ref: Date = new Date()): Promise<{
  pontos: PesoPonto[];
  atual: number | null;
  variacao30d: number | null;
  alvo: number;
}> {
  const [registros, alvoSetting] = await Promise.all([
    db.weightLog.findMany({ orderBy: { data: "asc" } }),
    db.setting.findUnique({ where: { key: "peso_alvo_kg" } }),
  ]);
  const alvo = Number(alvoSetting?.value ?? 78) || 78;

  const pontos: PesoPonto[] = registros.map((r, i) => {
    const janela = registros.slice(Math.max(0, i - 6), i + 1);
    return {
      label: dayKeySP(r.data).slice(5).split("-").reverse().join("/"),
      peso: r.pesoKg,
      media7:
        janela.length > 1
          ? Number(
              (janela.reduce((s, x) => s + x.pesoKg, 0) / janela.length).toFixed(2)
            )
          : null,
      meta: alvo,
    };
  });

  const atual = registros.at(-1)?.pesoKg ?? null;
  const limite = subDays(toSP(ref), 30);
  const antigo = [...registros].reverse().find((r) => r.data <= limite);

  return {
    pontos,
    atual,
    variacao30d:
      atual != null && antigo && antigo.pesoKg > 0
        ? ((atual - antigo.pesoKg) / antigo.pesoKg) * 100
        : null,
    alvo,
  };
}
