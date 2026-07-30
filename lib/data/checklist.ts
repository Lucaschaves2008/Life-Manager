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
  cacheLife("days");
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
  cacheLife("days");

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
  cacheLife("days");

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
