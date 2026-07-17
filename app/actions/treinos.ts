"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

function revalidar() {
  revalidatePath("/treinos");
  revalidatePath("/");
}

function dataSP(dia: string): Date {
  return new Date(`${dia}T12:00:00-03:00`);
}

// ---------- Fichas ----------

export async function createRoutine(nome: string, foco: string) {
  const total = await db.routine.count();
  const rotina = await db.routine.create({
    data: { nome, foco: foco || null, ordem: total },
  });
  revalidar();
  return rotina.id;
}

export async function updateRoutine(id: string, nome: string, foco: string) {
  await db.routine.update({ where: { id }, data: { nome, foco: foco || null } });
  revalidar();
}

export async function deleteRoutine(id: string) {
  await db.routine.delete({ where: { id } });
  revalidar();
}

export async function duplicateRoutine(id: string) {
  const rotina = await db.routine.findUnique({
    where: { id },
    include: { exercises: { orderBy: { ordem: "asc" } } },
  });
  if (!rotina) return;
  await db.routine.create({
    data: {
      nome: `${rotina.nome} (cópia)`,
      foco: rotina.foco,
      ordem: rotina.ordem + 1,
      exercises: {
        create: rotina.exercises.map((e) => ({
          nome: e.nome,
          grupoMuscular: e.grupoMuscular,
          series: e.series,
          repsAlvo: e.repsAlvo,
          cargaAtual: e.cargaAtual,
          descansoSeg: e.descansoSeg,
          observacao: e.observacao,
          ordem: e.ordem,
        })),
      },
    },
  });
  revalidar();
}

// ---------- Exercícios ----------

export type ExercicioInput = {
  nome: string;
  grupoMuscular: string;
  series: number;
  repsAlvo: string;
  cargaAtual: number;
  descansoSeg: number;
  observacao?: string | null;
};

export async function createExercise(routineId: string, input: ExercicioInput) {
  const total = await db.routineExercise.count({ where: { routineId } });
  await db.routineExercise.create({
    data: {
      ...input,
      observacao: input.observacao?.trim() || null,
      routineId,
      ordem: total,
    },
  });
  revalidar();
}

export async function updateExercise(id: string, input: ExercicioInput) {
  await db.routineExercise.update({
    where: { id },
    data: { ...input, observacao: input.observacao?.trim() || null },
  });
  revalidar();
}

export async function deleteExercise(id: string) {
  await db.routineExercise.delete({ where: { id } });
  revalidar();
}

/** Troca a ordem do exercício com o vizinho (direcao -1 = sobe, 1 = desce). */
export async function moveExercise(id: string, direcao: -1 | 1) {
  const atual = await db.routineExercise.findUnique({ where: { id } });
  if (!atual) return;
  const irmaos = await db.routineExercise.findMany({
    where: { routineId: atual.routineId },
    orderBy: { ordem: "asc" },
  });
  const i = irmaos.findIndex((e) => e.id === id);
  const j = i + direcao;
  if (j < 0 || j >= irmaos.length) return;

  await db.$transaction([
    db.routineExercise.update({
      where: { id: irmaos[i].id },
      data: { ordem: irmaos[j].ordem },
    }),
    db.routineExercise.update({
      where: { id: irmaos[j].id },
      data: { ordem: irmaos[i].ordem },
    }),
  ]);
  revalidar();
}

// ---------- Sessões ----------

export type SerieRealizada = { exerciseId: string; serie: number; reps: number; cargaKg: number };

export async function saveSession(input: {
  routineId: string;
  duracaoMin: number;
  notas?: string | null;
  series: SerieRealizada[];
}) {
  const sessao = await db.workoutSession.create({
    data: {
      data: new Date(),
      duracaoMin: input.duracaoMin,
      concluida: true,
      notas: input.notas?.trim() || null,
      routineId: input.routineId,
      setLogs: {
        create: input.series.map((s) => ({
          serie: s.serie,
          reps: s.reps,
          cargaKg: s.cargaKg,
          exerciseId: s.exerciseId,
        })),
      },
    },
  });

  // sobe a carga atual do exercício quando o treino usou mais peso
  const maxPorExercicio = new Map<string, number>();
  for (const s of input.series) {
    maxPorExercicio.set(
      s.exerciseId,
      Math.max(maxPorExercicio.get(s.exerciseId) ?? 0, s.cargaKg)
    );
  }
  const exercicios = await db.routineExercise.findMany({
    where: { id: { in: Array.from(maxPorExercicio.keys()) } },
  });
  await Promise.all(
    exercicios
      .filter((e) => (maxPorExercicio.get(e.id) ?? 0) > e.cargaAtual)
      .map((e) =>
        db.routineExercise.update({
          where: { id: e.id },
          data: { cargaAtual: maxPorExercicio.get(e.id)! },
        })
      )
  );

  revalidar();
  return sessao.id;
}

export async function deleteSession(id: string) {
  await db.workoutSession.delete({ where: { id } });
  revalidar();
}

// ---------- Corridas ----------

export type CorridaInput = {
  data: string; // yyyy-MM-dd
  km: number;
  segundos: number;
  tipo: string;
  sensacao: number;
  notas?: string | null;
};

export async function createRun(input: CorridaInput) {
  await db.run.create({
    data: {
      data: dataSP(input.data),
      km: input.km,
      segundos: input.segundos,
      tipo: input.tipo,
      sensacao: input.sensacao,
      notas: input.notas?.trim() || null,
    },
  });
  revalidar();
}

export async function updateRun(id: string, input: CorridaInput) {
  await db.run.update({
    where: { id },
    data: {
      data: dataSP(input.data),
      km: input.km,
      segundos: input.segundos,
      tipo: input.tipo,
      sensacao: input.sensacao,
      notas: input.notas?.trim() || null,
    },
  });
  revalidar();
}

export async function deleteRun(id: string) {
  const corrida = await db.run.findUnique({ where: { id } });
  await db.run.delete({ where: { id } });
  revalidar();
  return corrida;
}

export async function restoreRun(dados: {
  data: Date;
  km: number;
  segundos: number;
  tipo: string;
  sensacao: number;
  notas: string | null;
}) {
  await db.run.create({ data: dados });
  revalidar();
}
