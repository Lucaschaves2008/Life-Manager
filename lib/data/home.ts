import { addDays, subDays } from "date-fns";
import { db } from "@/lib/db";
import {
  dayKeySP,
  isSameDaySP,
  nowSP,
  spEndOfDay,
  spEndOfWeek,
  spStartOfDay,
  spStartOfWeek,
  timeHM,
} from "@/lib/dates";
import { expandEvents } from "@/lib/recurrence";
import { parseJSON } from "@/lib/utils";

export async function getSetting(key: string, fallback: string) {
  const s = await db.setting.findUnique({ where: { key } });
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

export async function eventosDeHoje(ref: Date = new Date()): Promise<EventoHoje[]> {
  const ini = spStartOfDay(ref);
  const fim = spEndOfDay(ref);

  const [events, holidays] = await Promise.all([
    db.event.findMany({
      where: { calendar: { visivel: true } },
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

export async function proximoEvento(ref: Date = new Date()): Promise<ProximoEvento> {
  const events = await db.event.findMany({
    where: { calendar: { visivel: true } },
    include: { calendar: true },
  });
  const occs = expandEvents(events, ref, addDays(ref, 7)).filter(
    (o) => o.inicio > ref && !o.event.diaInteiro
  );
  const next = occs[0];
  if (!next) return null;
  const hoje = isSameDaySP(next.inicio, ref);
  const amanha = isSameDaySP(next.inicio, addDays(spStartOfDay(ref), 1));
  const dia = hoje ? "hoje" : amanha ? "amanhã" : dayKeySP(next.inicio).slice(8) + "/" + dayKeySP(next.inicio).slice(5, 7);
  return {
    titulo: next.event.titulo,
    quando: `${dia} · ${timeHM(next.inicio)}`,
    cor: next.event.calendar.cor,
  };
}

// ---------- Treinos da semana ----------

export async function treinosDaSemana(ref: Date = new Date()) {
  const ini = spStartOfWeek(ref);
  const fim = spEndOfWeek(ref);
  const [sessoes, corridas, meta] = await Promise.all([
    db.workoutSession.count({ where: { data: { gte: ini, lte: fim } } }),
    db.run.count({ where: { data: { gte: ini, lte: fim } } }),
    getSetting("meta_treinos_semana", "4"),
  ]);
  return { total: sessoes + corridas, meta: parseInt(meta, 10) };
}

// ---------- Kcal de hoje ----------

export type KcalHoje = {
  consumidas: number;
  meta: number;
};

type ExtraLog = { nome: string; kcal: number; prot: number; carb: number; gord: number };

/** kcal de um MealItem a partir do Food. */
function kcalDoItem(item: {
  quantidade: number;
  unidade: string;
  food: {
    kcal100: number | null;
    porcaoG: number | null;
  };
}): number {
  const kcal100 = item.food.kcal100 ?? 0;
  const gramas =
    item.unidade === "porcao"
      ? item.quantidade * (item.food.porcaoG ?? 100)
      : item.quantidade;
  return (kcal100 * gramas) / 100;
}

export async function kcalHoje(ref: Date = new Date()): Promise<KcalHoje> {
  const dieta = await db.diet.findFirst({
    where: { ativa: true },
    include: { meals: { include: { items: { include: { food: true } } } } },
  });
  const log = await db.dietDayLog.findFirst({
    where: { data: { gte: spStartOfDay(ref), lte: spEndOfDay(ref) } },
  });

  const meta = dieta?.metaKcal ?? 2200;
  if (!log) return { consumidas: 0, meta };

  const cumpridas = new Set(parseJSON<string[]>(log.refeicoesCumpridas, []));
  let kcal = 0;
  for (const meal of dieta?.meals ?? []) {
    if (!cumpridas.has(meal.id)) continue;
    for (const item of meal.items) kcal += kcalDoItem(item);
  }
  for (const extra of parseJSON<ExtraLog[]>(log.extras, [])) kcal += extra.kcal;

  return { consumidas: Math.round(kcal), meta };
}

/** Média de kcal dos últimos 7 dias com diário preenchido. */
export async function mediaKcal7d(ref: Date = new Date()): Promise<number> {
  const dieta = await db.diet.findFirst({
    where: { ativa: true },
    include: { meals: { include: { items: { include: { food: true } } } } },
  });
  if (!dieta) return 0;

  const logs = await db.dietDayLog.findMany({
    where: {
      data: { gte: spStartOfDay(subDays(ref, 7)), lte: spEndOfDay(subDays(ref, 1)) },
    },
  });
  if (logs.length === 0) return 0;

  let total = 0;
  for (const log of logs) {
    const cumpridas = new Set(parseJSON<string[]>(log.refeicoesCumpridas, []));
    for (const meal of dieta.meals) {
      if (!cumpridas.has(meal.id)) continue;
      for (const item of meal.items) total += kcalDoItem(item);
    }
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
export async function streakLC(ref: Date = new Date()): Promise<StreakData> {
  const inicio = subDays(spStartOfDay(ref), 180);
  const [sessoes, corridas, diarios] = await Promise.all([
    db.workoutSession.findMany({
      where: { data: { gte: inicio } },
      select: { data: true },
    }),
    db.run.findMany({ where: { data: { gte: inicio } }, select: { data: true } }),
    db.dietDayLog.findMany({
      where: { data: { gte: inicio } },
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
    const dia = subDays(spStartOfDay(ref), d);
    if (dia >= fimDaAtual) break;
    if (diasCumpridos.has(dayKeySP(dia))) {
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
    const dia = addDays(inicioHeat, i);
    if (dia > fimSemana) break;
    const key = dayKeySP(dia);
    const cumpriu = diasCumpridos.has(key);
    const futuro = dia > ref;
    heatmap.push({
      key,
      value: futuro ? 0 : cumpriu ? 1 : 0,
      label: `${key.slice(8)}/${key.slice(5, 7)}${cumpriu ? " · cumprido" : ""}`,
    });
  }

  return { streak, recordeAnterior, heatmap };
}
