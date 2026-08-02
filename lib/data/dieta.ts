import {
  cacheLife,
  cacheTag,
} from "next/cache";
import { subDays, subYears } from "date-fns";
import { db } from "@/lib/db";
import { tagUsuario } from "@/lib/cache-tags";
import { dayKeySP, refDoDiaSP, spEndOfDay, spStartOfDay, toSP } from "@/lib/dates";
import { parseJSON } from "@/lib/utils";

// Padrão de cache (ver lib/data/home.ts): a função exportada mantém a
// assinatura original (userId, ref?) e delega para uma interna "use cache"
// com chaves ESTÁVEIS (userId + dayKey) — nunca um Date de request.

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

export type EscolhaLog = { mealId: string; optionId: string };

export type OpcaoView = {
  id: string;
  nome: string;
  macros: Macros;
  itens: { id: string; nome: string; quantidade: number; unidade: string }[];
};

export type RefeicaoView = {
  id: string;
  nome: string;
  horario: string | null;
  /** macros da opção escolhida hoje; senão da 1ª opção (preview). */
  macros: Macros;
  /** id da opção comida hoje (null = ainda não escolhida). */
  escolhaId: string | null;
  opcoes: OpcaoView[];
  /** itens da opção escolhida (ou da 1ª) — compat com quem lê itens direto. */
  itens: { id: string; nome: string; quantidade: number; unidade: string }[];
};

export type DiaDaDieta = {
  data: string;
  consumido: Macros;
  metas: Macros;
  cumpridas: string[];
  /** ids de refeições apagadas só neste dia (ver DietDayLog.refeicoesPuladas). */
  puladas: string[];
  extras: ExtraLog[];
  aguaMl: number;
  metaAguaMl: number;
  copoMl: number;
  notas: string;
  refeicoes: RefeicaoView[];
  dietaNome: string | null;
};

export async function diaDaDieta(
  userId: string,
  ref: Date = new Date()
): Promise<DiaDaDieta> {
  return diaDaDietaDoDia(userId, dayKeySP(ref));
}

async function diaDaDietaDoDia(userId: string, dia: string): Promise<DiaDaDieta> {
  "use cache";
  cacheTag(tagUsuario(userId, "dieta"), tagUsuario(userId, "settings"));
  cacheLife("usuario");

  const ref = refDoDiaSP(dia);
  const [dieta, log, metaAgua, copoAgua] = await Promise.all([
    db.diet.findFirst({
      where: { userId, ativa: true },
      include: {
        meals: {
          orderBy: { ordem: "asc" },
          include: {
            options: {
              orderBy: { ordem: "asc" },
              include: { items: { include: { food: true } } },
            },
          },
        },
      },
    }),
    db.dietDayLog.findFirst({
      where: { userId, data: { gte: spStartOfDay(ref), lte: spEndOfDay(ref) } },
    }),
    db.setting.findUnique({ where: { userId_key: { userId, key: "meta_agua_ml" } } }),
    db.setting.findUnique({ where: { userId_key: { userId, key: "agua_copo_ml" } } }),
  ]);

  const cumpridas = parseJSON<string[]>(log?.refeicoesCumpridas ?? "[]", []);
  const puladas = parseJSON<string[]>(log?.refeicoesPuladas ?? "[]", []);
  const extras = parseJSON<ExtraLog[]>(log?.extras ?? "[]", []);
  const escolhas = parseJSON<EscolhaLog[]>(log?.escolhas ?? "[]", []);
  const escolhaPorMeal = new Map(escolhas.map((e) => [e.mealId, e.optionId]));

  const refeicoes: RefeicaoView[] = (dieta?.meals ?? []).map((meal) => {
    const opcoes: OpcaoView[] = meal.options.map((o) => ({
      id: o.id,
      nome: o.nome,
      macros: macrosDaRefeicao(o.items),
      itens: o.items.map((i) => ({
        id: i.id,
        nome: i.food.nome,
        quantidade: i.quantidade,
        unidade: i.unidade,
      })),
    }));

    const escolhaId = escolhaPorMeal.get(meal.id) ?? null;
    // opção efetiva p/ exibição: a escolhida hoje, senão a 1ª (preview)
    const efetiva =
      (escolhaId && opcoes.find((o) => o.id === escolhaId)) || opcoes[0] || null;

    return {
      id: meal.id,
      nome: meal.nome,
      horario: meal.horario,
      macros: efetiva?.macros ?? macrosZero,
      escolhaId,
      opcoes,
      itens: efetiva?.itens ?? [],
    };
  });

  let consumido = macrosZero;
  for (const r of refeicoes) {
    // só conta se cumprida E com uma opção escolhida (macros da escolhida)
    if (cumpridas.includes(r.id) && r.escolhaId) {
      const escolhida = r.opcoes.find((o) => o.id === r.escolhaId);
      if (escolhida) consumido = somaMacros(consumido, escolhida.macros);
    }
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
    data: dia,
    consumido,
    metas: {
      kcal: dieta?.metaKcal ?? 2200,
      prot: dieta?.metaProt ?? 160,
      carb: dieta?.metaCarb ?? 220,
      gord: dieta?.metaGord ?? 60,
    },
    cumpridas,
    puladas,
    extras,
    aguaMl: log?.aguaMl ?? 0,
    metaAguaMl: Number(metaAgua?.value ?? 3000) || 3000,
    copoMl: Number(copoAgua?.value ?? 250) || 250,
    notas: log?.notas ?? "",
    refeicoes,
    dietaNome: dieta?.nome ?? null,
  };
}

// ---------- Checklist diário ----------

/**
 * Refeição da dieta ativa exibida como item do checklist do dia.
 *
 * Deriva do MESMO DietDayLog que a tela de Dieta usa — nunca é uma cópia. Os
 * dois lugares leem e escrevem o mesmo registro, então marcar em um aparece no
 * outro e a métrica "refeicoes_cumpridas" (metas e desafios) conta uma vez só.
 */
export type RefeicaoChecklistItem = {
  id: string;
  nome: string;
  horario: string | null;
  feito: boolean;
  escolhaId: string | null;
  opcoes: { id: string; nome: string }[];
};

/**
 * Refeições do dia no formato do checklist. Reaproveita diaDaDieta (já
 * cacheado por userId+dayKey) em vez de refazer as queries — a projeção aqui é
 * só o recorte que a linha do checklist precisa.
 *
 * As apagadas no dia (DietDayLog.refeicoesPuladas) ficam de fora: sumiram do
 * checklist de hoje, mas continuam na dieta e voltam amanhã.
 */
export async function refeicoesDoDiaChecklist(
  userId: string,
  ref: Date = new Date()
): Promise<RefeicaoChecklistItem[]> {
  const dia = await diaDaDieta(userId, ref);
  const cumpridas = new Set(dia.cumpridas);
  const puladas = new Set(dia.puladas);
  return dia.refeicoes
    .filter((r) => !puladas.has(r.id))
    .map((r) => ({
      id: r.id,
      nome: r.nome,
      horario: r.horario,
      feito: cumpridas.has(r.id),
      escolhaId: r.escolhaId,
      opcoes: r.opcoes.map((o) => ({ id: o.id, nome: o.nome })),
    }));
}

/**
 * As refeições apagadas só neste dia — para o checklist poder oferecer o
 * "restaurar" em vez de deixar o item sumir sem volta.
 */
export async function refeicoesPuladasDoDia(
  userId: string,
  ref: Date = new Date()
): Promise<{ id: string; nome: string }[]> {
  const dia = await diaDaDieta(userId, ref);
  const puladas = new Set(dia.puladas);
  return dia.refeicoes.filter((r) => puladas.has(r.id)).map((r) => ({ id: r.id, nome: r.nome }));
}

/**
 * Água do dia como pseudo-item do checklist.
 *
 * Deriva do MESMO DietDayLog.aguaMl que os copos em /dieta escrevem — marcar
 * os copos lá até bater a meta (Setting "meta_agua_ml") marca este item aqui
 * automaticamente, sem ação própria: não há toggle, só leitura.
 */
export type AguaChecklistItem = {
  aguaMl: number;
  metaAguaMl: number;
  copoMl: number;
  feito: boolean;
};

export async function aguaDoDiaChecklist(
  userId: string,
  ref: Date = new Date()
): Promise<AguaChecklistItem> {
  const dia = await diaDaDieta(userId, ref);
  return {
    aguaMl: dia.aguaMl,
    metaAguaMl: dia.metaAguaMl,
    copoMl: dia.copoMl,
    feito: dia.aguaMl >= dia.metaAguaMl,
  };
}

/** % de refeições cumpridas nos últimos 7 dias. */
export async function aderencia7d(
  userId: string,
  ref: Date = new Date()
): Promise<number> {
  return aderencia7dDoDia(userId, dayKeySP(ref));
}

async function aderencia7dDoDia(userId: string, dia: string): Promise<number> {
  "use cache";
  cacheTag(tagUsuario(userId, "dieta"));
  cacheLife("usuario");

  const ref = refDoDiaSP(dia);
  const dieta = await db.diet.findFirst({
    where: { userId, ativa: true },
    include: { meals: true },
  });
  if (!dieta || dieta.meals.length === 0) return 0;

  const logs = await db.dietDayLog.findMany({
    where: {
      userId,
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
export async function streakDieta(
  userId: string,
  ref: Date = new Date()
): Promise<number> {
  return streakDietaDoDia(userId, dayKeySP(ref));
}

async function streakDietaDoDia(userId: string, dia: string): Promise<number> {
  "use cache";
  cacheTag(tagUsuario(userId, "dieta"));
  cacheLife("usuario");

  const ref = refDoDiaSP(dia);
  const logs = await db.dietDayLog.findMany({
    where: { userId, data: { gte: spStartOfDay(subDays(toSP(ref), 120)) } },
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
    const chave = dayKeySP(subDays(toSP(ref), i));
    if (dias.has(chave)) streak++;
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

export type EvolucaoPeso = {
  pontos: PesoPonto[];
  atual: number | null;
  variacao30d: number | null;
  alvo: number;
  /** false quando `alvo` é só o fallback (78kg) — nenhuma meta foi definida pelo usuário. */
  temMeta: boolean;
};

export async function evolucaoPeso(
  userId: string,
  ref: Date = new Date()
): Promise<EvolucaoPeso> {
  return evolucaoPesoDoDia(userId, dayKeySP(ref));
}

async function evolucaoPesoDoDia(userId: string, dia: string): Promise<EvolucaoPeso> {
  "use cache";
  cacheTag(tagUsuario(userId, "dieta"), tagUsuario(userId, "settings"));
  cacheLife("usuario");

  const ref = refDoDiaSP(dia);
  // Janela de 12 meses; 6 pontos anteriores mantêm a média móvel correta no início.
  const inicioJanela = spStartOfDay(subYears(toSP(ref), 1));
  const [registros, anteriores, alvoSetting] = await Promise.all([
    db.weightLog.findMany({
      where: { userId, data: { gte: inicioJanela } },
      orderBy: { data: "asc" },
    }),
    db.weightLog.findMany({
      where: { userId, data: { lt: inicioJanela } },
      orderBy: { data: "desc" },
      take: 6,
    }),
    db.setting.findUnique({ where: { userId_key: { userId, key: "peso_alvo_kg" } } }),
  ]);
  const temMeta = alvoSetting != null && Number(alvoSetting.value) > 0;
  const alvo = temMeta ? Number(alvoSetting!.value) : 78;

  const todos = [...anteriores.reverse(), ...registros];
  const base = todos.length - registros.length;

  const pontos: PesoPonto[] = registros.map((r, i) => {
    const janela = todos.slice(Math.max(0, base + i - 6), base + i + 1);
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

  const atual = todos.at(-1)?.pesoKg ?? null;
  const limite = subDays(toSP(ref), 30);
  const antigo = [...todos].reverse().find((r) => r.data <= limite);

  return {
    pontos,
    atual,
    variacao30d:
      atual != null && antigo && antigo.pesoKg > 0
        ? ((atual - antigo.pesoKg) / antigo.pesoKg) * 100
        : null,
    alvo,
    temMeta,
  };
}
