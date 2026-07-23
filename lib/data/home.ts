import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
} from "next/cache";
import { addDays, subDays } from "date-fns";
import { db } from "@/lib/db";
import { TAG_FERIADOS, tagUsuario } from "@/lib/cache-tags";
import {
  dayKeySP,
  isSameDaySP,
  refDoDiaSP,
  spEndOfDay,
  spEndOfWeek,
  spStartOfDay,
  spStartOfWeek,
  timeHM,
} from "@/lib/dates";
import { expandEvents } from "@/lib/recurrence";
import { parseJSON } from "@/lib/utils";

// Padrão de cache deste arquivo: a função exportada mantém a assinatura
// original (userId, ref?) e delega para uma função interna "use cache" cujos
// argumentos são chaves ESTÁVEIS (userId + dayKey) — nunca um Date de
// request. Cada função cacheada registra a tag de todo módulo que ela lê;
// as server actions desses módulos chamam revalidateTag na escrita.

export async function getSetting(userId: string, key: string, fallback: string) {
  "use cache";
  cacheTag(tagUsuario(userId, "settings"));
  cacheLife("days");
  const s = await db.setting.findUnique({ where: { userId_key: { userId, key } } });
  return s?.value ?? fallback;
}

// ---------- Agenda de hoje ----------

export type EventoHoje = {
  id: string;
  titulo: string;
  hora: string | null; // null = dia inteiro
  fim: string | null;
  cor: string;
  agenda: string;
};

export async function eventosDeHoje(
  userId: string,
  ref: Date = new Date()
): Promise<EventoHoje[]> {
  return eventosDoDia(userId, dayKeySP(ref));
}

async function eventosDoDia(userId: string, dia: string): Promise<EventoHoje[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "agenda"), TAG_FERIADOS);
  cacheLife("days");

  const ref = refDoDiaSP(dia);
  const ini = spStartOfDay(ref);
  const fim = spEndOfDay(ref);

  const [events, holidays] = await Promise.all([
    db.event.findMany({
      // recorrentes vêm sempre (expandEvents decide as ocorrências); únicos só se intersectam o dia
      where: {
        userId,
        calendar: { visivel: true },
        OR: [{ rrule: { not: null } }, { inicio: { lte: fim }, fim: { gte: ini } }],
      },
      include: { calendar: true },
    }),
    db.holiday.findMany({ where: { data: { gte: ini, lte: fim } } }),
  ]);

  const occs = expandEvents(events, ini, fim).map((occ) => ({
    id: `${occ.event.id}:${occ.dayKey}`,
    titulo: occ.event.titulo,
    hora: occ.event.diaInteiro ? null : timeHM(occ.inicio),
    fim: occ.event.diaInteiro ? null : timeHM(occ.fim),
    cor: occ.event.calendar.cor,
    agenda: occ.event.calendar.nome,
  }));

  const feriados = holidays.map((h) => ({
    id: `holiday:${h.id}`,
    titulo: h.nome,
    hora: null,
    fim: null,
    cor: "#A78BDB",
    agenda: "Feriados no Brasil",
  }));

  return [...feriados, ...occs].sort((a, b) =>
    (a.hora ?? "") < (b.hora ?? "") ? -1 : 1
  );
}

export type ProximoEvento = {
  titulo: string;
  quando: string;
  cor: string;
} | null;

export async function proximoEvento(
  userId: string,
  ref: Date = new Date()
): Promise<ProximoEvento> {
  // A parte cara (fetch + expansão de recorrência) é cacheada por dia; o
  // filtro sensível à hora ("já passou?") roda fora do cache, sobre o ref real.
  const occs = await ocorrenciasProximas(userId, dayKeySP(ref));
  const fimJanela = addDays(ref, 7);
  const next = occs.find(
    (o) => o.inicio > ref && o.inicio <= fimJanela && !o.diaInteiro
  );
  if (!next) return null;
  const hoje = isSameDaySP(next.inicio, ref);
  const amanha = isSameDaySP(next.inicio, addDays(spStartOfDay(ref), 1));
  const dia = hoje
    ? "hoje"
    : amanha
    ? "amanhã"
    : dayKeySP(next.inicio).slice(8) + "/" + dayKeySP(next.inicio).slice(5, 7);
  return {
    titulo: next.titulo,
    quando: `${dia} · ${timeHM(next.inicio)}`,
    cor: next.cor,
  };
}

type OcorrenciaProxima = {
  titulo: string;
  cor: string;
  inicio: Date;
  diaInteiro: boolean;
};

async function ocorrenciasProximas(
  userId: string,
  dia: string
): Promise<OcorrenciaProxima[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "agenda"));
  cacheLife("days");

  const ini = spStartOfDay(refDoDiaSP(dia));
  const fimJanela = spEndOfDay(addDays(ini, 8)); // superjanela; o wrapper refina

  const events = await db.event.findMany({
    // recorrentes vêm sempre (expandEvents decide as ocorrências); únicos só se intersectam a janela
    where: {
      userId,
      calendar: { visivel: true },
      OR: [{ rrule: { not: null } }, { inicio: { lte: fimJanela }, fim: { gte: ini } }],
    },
    include: { calendar: true },
  });
  return expandEvents(events, ini, fimJanela).map((o) => ({
    titulo: o.event.titulo,
    cor: o.event.calendar.cor,
    inicio: o.inicio,
    diaInteiro: o.event.diaInteiro,
  }));
}

// ---------- Treinos da semana ----------

export async function treinosDaSemana(userId: string, ref: Date = new Date()) {
  return treinosDaSemanaDoDia(userId, dayKeySP(ref));
}

async function treinosDaSemanaDoDia(userId: string, dia: string) {
  "use cache";
  cacheTag(tagUsuario(userId, "treinos"), tagUsuario(userId, "settings"));
  cacheLife("days");

  const ref = refDoDiaSP(dia);
  const ini = spStartOfWeek(ref);
  const fim = spEndOfWeek(ref);
  const [sessoes, corridas, meta] = await Promise.all([
    db.workoutSession.count({ where: { userId, data: { gte: ini, lte: fim } } }),
    db.run.count({ where: { userId, data: { gte: ini, lte: fim } } }),
    getSetting(userId, "meta_treinos_semana", "4"),
  ]);
  return { total: sessoes + corridas, meta: parseInt(meta, 10) };
}

// ---------- Kcal de hoje ----------

export type KcalHoje = {
  consumidas: number;
  meta: number;
};

type ExtraLog = { nome: string; kcal: number; prot: number; carb: number; gord: number };
type EscolhaLog = { mealId: string; optionId: string };

type MealItemLike = {
  quantidade: number;
  unidade: string;
  food: { kcal100: number | null; porcaoG: number | null };
};
type MealComOpcoes = {
  id: string;
  options: { id: string; items: MealItemLike[] }[];
};

/** kcal de um MealItem a partir do Food. */
function kcalDoItem(item: MealItemLike): number {
  const kcal100 = item.food.kcal100 ?? 0;
  const gramas =
    item.unidade === "porcao"
      ? item.quantidade * (item.food.porcaoG ?? 100)
      : item.quantidade;
  return (kcal100 * gramas) / 100;
}

/**
 * kcal das refeições cumpridas num dia: para cada meal cumprida, soma os itens
 * da OPÇÃO escolhida (sem escolha → não conta, coerente com diaDaDieta).
 */
function kcalDoLog(
  meals: MealComOpcoes[],
  cumpridas: Set<string>,
  escolhas: EscolhaLog[]
): number {
  const escolhaPorMeal = new Map(escolhas.map((e) => [e.mealId, e.optionId]));
  let kcal = 0;
  for (const meal of meals) {
    if (!cumpridas.has(meal.id)) continue;
    const optionId = escolhaPorMeal.get(meal.id);
    if (!optionId) continue;
    const opcao = meal.options.find((o) => o.id === optionId);
    if (!opcao) continue;
    for (const item of opcao.items) kcal += kcalDoItem(item);
  }
  return kcal;
}

export async function kcalHoje(
  userId: string,
  ref: Date = new Date()
): Promise<KcalHoje> {
  return kcalDoDia(userId, dayKeySP(ref));
}

async function kcalDoDia(userId: string, dia: string): Promise<KcalHoje> {
  "use cache";
  cacheTag(tagUsuario(userId, "dieta"));
  cacheLife("days");

  const ref = refDoDiaSP(dia);
  const dieta = await db.diet.findFirst({
    where: { userId, ativa: true },
    include: {
      meals: { include: { options: { include: { items: { include: { food: true } } } } } },
    },
  });
  const log = await db.dietDayLog.findFirst({
    where: { userId, data: { gte: spStartOfDay(ref), lte: spEndOfDay(ref) } },
  });

  const meta = dieta?.metaKcal ?? 2200;
  if (!log) return { consumidas: 0, meta };

  const cumpridas = new Set(parseJSON<string[]>(log.refeicoesCumpridas, []));
  const escolhas = parseJSON<EscolhaLog[]>(log.escolhas, []);
  let kcal = kcalDoLog(dieta?.meals ?? [], cumpridas, escolhas);
  for (const extra of parseJSON<ExtraLog[]>(log.extras, [])) kcal += extra.kcal;

  return { consumidas: Math.round(kcal), meta };
}

/** Média de kcal dos últimos 7 dias com diário preenchido. */
export async function mediaKcal7d(
  userId: string,
  ref: Date = new Date()
): Promise<number> {
  return mediaKcal7dDoDia(userId, dayKeySP(ref));
}

async function mediaKcal7dDoDia(userId: string, dia: string): Promise<number> {
  "use cache";
  cacheTag(tagUsuario(userId, "dieta"));
  cacheLife("days");

  const ref = refDoDiaSP(dia);
  const dieta = await db.diet.findFirst({
    where: { userId, ativa: true },
    include: {
      meals: { include: { options: { include: { items: { include: { food: true } } } } } },
    },
  });
  if (!dieta) return 0;

  const logs = await db.dietDayLog.findMany({
    where: {
      userId,
      data: { gte: spStartOfDay(subDays(ref, 7)), lte: spEndOfDay(subDays(ref, 1)) },
    },
  });
  if (logs.length === 0) return 0;

  let total = 0;
  for (const log of logs) {
    const cumpridas = new Set(parseJSON<string[]>(log.refeicoesCumpridas, []));
    const escolhas = parseJSON<EscolhaLog[]>(log.escolhas, []);
    total += kcalDoLog(dieta.meals, cumpridas, escolhas);
    for (const extra of parseJSON<ExtraLog[]>(log.extras, [])) total += extra.kcal;
  }
  return total / logs.length;
}

// ---------- Streak LC ----------

export type StreakData = {
  streak: number;
  recordeAnterior: number;
  /** últimas 8 semanas p/ mini-heatmap (56 células, domingo→sábado) */
  heatmap: { key: string; value: number; label?: string }[];
};

/**
 * Streak: dias consecutivos cumprindo o mínimo
 * (≥1 treino registrado OU diário de dieta preenchido no dia).
 */
export async function streakLC(
  userId: string,
  ref: Date = new Date()
): Promise<StreakData> {
  return streakDoDia(userId, dayKeySP(ref));
}

async function streakDoDia(userId: string, dia: string): Promise<StreakData> {
  "use cache";
  cacheTag(tagUsuario(userId, "treinos"), tagUsuario(userId, "dieta"));
  cacheLife("days");

  const ref = refDoDiaSP(dia);
  const inicio = subDays(spStartOfDay(ref), 180);
  const [sessoes, corridas, diarios] = await Promise.all([
    db.workoutSession.findMany({
      where: { userId, data: { gte: inicio } },
      select: { data: true },
    }),
    db.run.findMany({
      where: { userId, data: { gte: inicio } },
      select: { data: true },
    }),
    db.dietDayLog.findMany({
      where: { userId, data: { gte: inicio } },
      select: { data: true, refeicoesCumpridas: true },
    }),
  ]);

  const diasCumpridos = new Set<string>();
  for (const s of sessoes) diasCumpridos.add(dayKeySP(s.data));
  for (const r of corridas) diasCumpridos.add(dayKeySP(r.data));
  for (const d of diarios) {
    if (parseJSON<string[]>(d.refeicoesCumpridas, []).length > 0)
      diasCumpridos.add(dayKeySP(d.data));
  }

  // streak atual: conta de hoje para trás (hoje ainda em aberto não quebra)
  let streak = 0;
  let cursor = spStartOfDay(ref);
  const hojeCumpriu = diasCumpridos.has(dayKeySP(cursor));
  if (!hojeCumpriu) cursor = subDays(cursor, 1);
  while (diasCumpridos.has(dayKeySP(cursor))) {
    streak++;
    cursor = subDays(cursor, 1);
  }

  // recorde anterior: maior sequência que termina antes do início da atual
  let recordeAnterior = 0;
  let atual = 0;
  const fimDaAtual = subDays(spStartOfDay(ref), streak + (hojeCumpriu ? 0 : 1));
  for (let d = 180; d >= 0; d--) {
    const dia2 = subDays(spStartOfDay(ref), d);
    if (dia2 >= fimDaAtual) break;
    if (diasCumpridos.has(dayKeySP(dia2))) {
      atual++;
      recordeAnterior = Math.max(recordeAnterior, atual);
    } else {
      atual = 0;
    }
  }

  // heatmap das últimas 8 semanas (domingo → sábado)
  const fimSemana = spEndOfWeek(ref);
  const inicioHeat = subDays(spStartOfWeek(ref), 7 * 7);
  const heatmap: StreakData["heatmap"] = [];
  for (let i = 0; i < 56; i++) {
    const diaHeat = addDays(inicioHeat, i);
    if (diaHeat > fimSemana) break;
    const key = dayKeySP(diaHeat);
    const cumpriu = diasCumpridos.has(key);
    const futuro = diaHeat > ref;
    heatmap.push({
      key,
      value: futuro ? 0 : cumpriu ? 1 : 0,
      label: `${key.slice(8)}/${key.slice(5, 7)}${cumpriu ? " · cumprido" : ""}`,
    });
  }

  return { streak, recordeAnterior, heatmap };
}
