import {
  cacheLife,
  cacheTag,
} from "next/cache";
import { eachDayOfInterval } from "date-fns";
import { db } from "@/lib/db";
import { tagUsuario } from "@/lib/cache-tags";
import { dayKeySP, refDoDiaSP, spEndOfDay, spStartOfDay, spStartOfMonth } from "@/lib/dates";
import { parseJSON } from "@/lib/utils";

// Padrão de cache: wrapper mantém a assinatura original e converte o Date de
// request em chave estável (dayKeySP); a interna "use cache" reconstrói o ref
// com refDoDiaSP. Tag única: "checklist" (tabelas habit/habitDayLog).

export type HabitoView = { id: string; nome: string; nota: string | null; ordem: number };

/** Hábitos ativos do usuário, ordenados. */
export async function habitosAtivos(userId: string): Promise<HabitoView[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "checklist"));
  cacheLife("usuario");
  const habitos = await db.habit.findMany({
    where: { userId, ativo: true },
    orderBy: { ordem: "asc" },
  });
  return habitos.map((h) => ({ id: h.id, nome: h.nome, nota: h.nota, ordem: h.ordem }));
}

/** IDs dos hábitos marcados como feitos no dia informado. */
export async function itensFeitosNoDia(userId: string, dia: Date): Promise<string[]> {
  return itensFeitosDoDia(userId, dayKeySP(dia));
}

async function itensFeitosDoDia(userId: string, dia: string): Promise<string[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "checklist"));
  cacheLife("usuario");

  const ref = refDoDiaSP(dia);
  const log = await db.habitDayLog.findFirst({
    where: { userId, data: { gte: spStartOfDay(ref), lte: spEndOfDay(ref) } },
  });
  return log ? parseJSON<string[]>(log.itensFeitos, []) : [];
}

export type PctMensalHabito = { habitId: string; pct: number; feitos: number; diasContados: number };

/**
 * % de cumprimento no mês de cada hábito ativo, contando apenas os dias já
 * passados do mês (hoje incluso) — dias futuros não entram no denominador.
 */
export async function percentualMensalHabitos(
  userId: string,
  hoje: Date
): Promise<PctMensalHabito[]> {
  return percentualMensalHabitosDoMes(userId, dayKeySP(hoje));
}

async function percentualMensalHabitosDoMes(
  userId: string,
  hojeKey: string
): Promise<PctMensalHabito[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "checklist"));
  cacheLife("usuario");

  const hoje = refDoDiaSP(hojeKey);
  const inicioMes = spStartOfMonth(hoje);
  const fimJanela = spEndOfDay(hoje);

  const [habitos, logs] = await Promise.all([
    db.habit.findMany({ where: { userId, ativo: true } }),
    db.habitDayLog.findMany({
      where: { userId, data: { gte: inicioMes, lte: fimJanela } },
    }),
  ]);

  const diasContados = eachDayOfInterval({ start: inicioMes, end: fimJanela }).length;

  const contagem = new Map<string, number>();
  for (const log of logs) {
    for (const id of parseJSON<string[]>(log.itensFeitos, [])) {
      contagem.set(id, (contagem.get(id) ?? 0) + 1);
    }
  }

  return habitos.map((h) => {
    const feitos = contagem.get(h.id) ?? 0;
    return {
      habitId: h.id,
      feitos,
      diasContados,
      pct: diasContados > 0 ? (feitos / diasContados) * 100 : 0,
    };
  });
}

export type MetaDiaView = { id: string; titulo: string; prioridade: number; feita: boolean };

export type ResumoMetasDia = {
  /** Total de metas e cumpridas nos últimos `dias` dias (hoje incluso). */
  total: number;
  feitas: number;
  pct: number | null;
  /** Dias em que havia ao menos uma meta e todas foram cumpridas. */
  diasPerfeitos: number;
  diasComMetas: number;
};

/** Metas do dia, da mais importante para a menos; dentro da prioridade, por ordem de criação. */
export async function metasDoDia(userId: string, dia: Date): Promise<MetaDiaView[]> {
  const metas = await db.metaDia.findMany({
    where: { userId, data: spStartOfDay(dia) },
    orderBy: [{ prioridade: "asc" }, { criadoEm: "asc" }],
  });
  return metas.map((m) => ({
    id: m.id,
    titulo: m.titulo,
    prioridade: m.prioridade,
    feita: m.feita,
  }));
}

/** Métrica das metas diárias: quantas foram cumpridas nos últimos N dias. */
export async function resumoMetasDia(
  userId: string,
  hoje: Date,
  dias = 7
): Promise<ResumoMetasDia> {
  const fim = spStartOfDay(hoje);
  const inicio = new Date(fim.getTime() - (dias - 1) * 24 * 60 * 60 * 1000);
  const metas = await db.metaDia.findMany({
    where: { userId, data: { gte: new Date(inicio.getTime() - 12 * 60 * 60 * 1000), lte: fim } },
    select: { data: true, feita: true },
  });
  const porDia = new Map<string, { total: number; feitas: number }>();
  for (const m of metas) {
    const k = dayKeySP(m.data);
    const acc = porDia.get(k) ?? { total: 0, feitas: 0 };
    acc.total += 1;
    if (m.feita) acc.feitas += 1;
    porDia.set(k, acc);
  }
  let total = 0;
  let feitas = 0;
  let diasPerfeitos = 0;
  for (const v of porDia.values()) {
    total += v.total;
    feitas += v.feitas;
    if (v.total > 0 && v.feitas === v.total) diasPerfeitos += 1;
  }
  return {
    total,
    feitas,
    pct: total > 0 ? Math.round((feitas / total) * 100) : null,
    diasPerfeitos,
    diasComMetas: porDia.size,
  };
}
