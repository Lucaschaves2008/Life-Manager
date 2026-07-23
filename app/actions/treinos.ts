"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { tagUsuario } from "@/lib/cache-tags";
import { spStartOfDay } from "@/lib/dates";
import { templateOcorreNoDia } from "@/lib/rotina-helpers";

function revalidar(userId: string) {
  revalidatePath("/treinos");
  revalidatePath("/");
  // toda mutação escreve tabelas de treinos → derruba o cache do módulo
  revalidateTag(tagUsuario(userId, "treinos"));
}

function dataSP(dia: string): Date {
  return new Date(`${dia}T12:00:00-03:00`);
}

/** Garante que a sessão de corrida referenciada pertence ao usuário. */
async function validarPosseDaSessao(userId: string, runSessionId?: string | null) {
  if (!runSessionId) return;
  const sessao = await db.runSession.findFirst({
    where: { id: runSessionId, userId },
    select: { id: true },
  });
  if (!sessao) throw new Error("Recurso não encontrado.");
}

/**
 * Auto-check do checklist: marca (RotinaCheckDia.feitoAuto) os templates que
 * apontam para `vinculoId` (routineId/runSessionId) e ocorrem no dia `quando`.
 * Não sobrescreve um check já existente. Revalida o checklist.
 */
async function autoCheckPlano(
  userId: string,
  campo: "routineId" | "runSessionId",
  vinculoId: string,
  quando: Date
) {
  const dia = spStartOfDay(quando);
  const templates = await db.rotinaTemplate.findMany({
    where: { userId, ativo: true, [campo]: vinculoId },
  });
  const ocorrentesHoje = templates.filter((t) => templateOcorreNoDia(t, dia));

  await Promise.all(
    ocorrentesHoje.map((t) =>
      db.rotinaCheckDia.upsert({
        where: { rotinaId_data: { rotinaId: t.id, data: dia } },
        create: { userId, rotinaId: t.id, data: dia, feitoAuto: true },
        update: {},
      })
    )
  );
  revalidateTag(tagUsuario(userId, "checklist"));
}

// ---------- Fichas ----------

export async function createRoutine(nome: string, foco: string) {
  const { id: userId } = await requireUser();
  const total = await db.routine.count({ where: { userId } });
  const rotina = await db.routine.create({
    data: { nome, foco: foco || null, ordem: total, userId },
  });
  revalidar(userId);
  return rotina.id;
}

export async function updateRoutine(id: string, nome: string, foco: string) {
  const { id: userId } = await requireUser();
  await db.routine.update({
    where: { id, userId },
    data: { nome, foco: foco || null },
  });
  revalidar(userId);
}

export async function deleteRoutine(id: string) {
  const { id: userId } = await requireUser();
  await db.routine.delete({ where: { id, userId } });
  revalidar(userId);
}

export async function duplicateRoutine(id: string) {
  const { id: userId } = await requireUser();
  const rotina = await db.routine.findFirst({
    where: { id, userId },
    include: {
      exercises: {
        orderBy: { ordem: "asc" },
        include: { weeks: { orderBy: { semana: "asc" } } },
      },
    },
  });
  if (!rotina) return;
  await db.routine.create({
    data: {
      userId,
      nome: `${rotina.nome} (cópia)`,
      foco: rotina.foco,
      ordem: rotina.ordem + 1,
      diasSemana: rotina.diasSemana,
      exercises: {
        create: rotina.exercises.map((e) => ({
          userId,
          nome: e.nome,
          grupoMuscular: e.grupoMuscular,
          tipoAlvo: e.tipoAlvo,
          series: e.series,
          repsAlvo: e.repsAlvo,
          cargaAtual: e.cargaAtual,
          tempoAlvoSeg: e.tempoAlvoSeg,
          descansoSeg: e.descansoSeg,
          observacao: e.observacao,
          ordem: e.ordem,
          metodo: e.metodo,
          weeks: {
            create: e.weeks.map((w) => ({
              userId,
              semana: w.semana,
              series: w.series,
              repsAlvo: w.repsAlvo,
              cargaAtual: w.cargaAtual,
            })),
          },
        })),
      },
    },
  });
  revalidar(userId);
}

/** Dias em que a ficha roda (0=dom..6=sáb), tipo "toda seg e qua". */
export async function setRoutineDias(routineId: string, dias: number[]) {
  const { id: userId } = await requireUser();
  const validos = Array.from(
    new Set(dias.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))
  ).sort((a, b) => a - b);
  await db.routine.update({
    where: { id: routineId, userId },
    data: { diasSemana: JSON.stringify(validos.map(String)) },
  });
  revalidar(userId);
}

// ---------- Exercícios ----------

export type ExercicioInput = {
  nome: string;
  grupoMuscular: string;
  tipoAlvo?: string; // "series" (padrão) | "tempo"
  series: number;
  repsAlvo: string;
  cargaAtual: number;
  tempoAlvoSeg?: number;
  descansoSeg: number;
  observacao?: string | null;
  metodo?: string;
};

export async function createExercise(routineId: string, input: ExercicioInput) {
  const { id: userId } = await requireUser();
  const rotina = await db.routine.findFirst({
    where: { id: routineId, userId },
    select: { id: true },
  });
  if (!rotina) throw new Error("Recurso não encontrado.");
  const total = await db.routineExercise.count({ where: { userId, routineId } });
  await db.routineExercise.create({
    data: {
      ...input,
      tipoAlvo: input.tipoAlvo ?? "series",
      tempoAlvoSeg: input.tempoAlvoSeg ?? 60,
      observacao: input.observacao?.trim() || null,
      routineId,
      ordem: total,
      userId,
    },
  });
  revalidar(userId);
}

export async function updateExercise(id: string, input: ExercicioInput) {
  const { id: userId } = await requireUser();
  await db.routineExercise.update({
    where: { id, userId },
    data: {
      ...input,
      tipoAlvo: input.tipoAlvo ?? "series",
      tempoAlvoSeg: input.tempoAlvoSeg ?? 60,
      observacao: input.observacao?.trim() || null,
    },
  });
  revalidar(userId);
}

/**
 * Atualiza só os metadados do exercício (que NÃO variam por semana): nome,
 * grupo, método, descanso, observação. Usado ao editar numa semana >= 2, onde
 * series/reps/carga vão para o override (setWeekExercise) e a base fica intacta.
 */
export async function updateExerciseMeta(
  id: string,
  input: Pick<
    ExercicioInput,
    "nome" | "grupoMuscular" | "metodo" | "descansoSeg" | "observacao" | "tipoAlvo" | "tempoAlvoSeg"
  >
) {
  const { id: userId } = await requireUser();
  await db.routineExercise.update({
    where: { id, userId },
    data: {
      nome: input.nome,
      grupoMuscular: input.grupoMuscular,
      metodo: input.metodo,
      descansoSeg: input.descansoSeg,
      observacao: input.observacao?.trim() || null,
      tipoAlvo: input.tipoAlvo ?? "series",
      tempoAlvoSeg: input.tempoAlvoSeg ?? 60,
    },
  });
  revalidar(userId);
}

export async function deleteExercise(id: string) {
  const { id: userId } = await requireUser();
  await db.routineExercise.delete({ where: { id, userId } });
  revalidar(userId);
}

/** Troca a ordem do exercício com o vizinho (direcao -1 = sobe, 1 = desce). */
export async function moveExercise(id: string, direcao: -1 | 1) {
  const { id: userId } = await requireUser();
  const atual = await db.routineExercise.findFirst({ where: { id, userId } });
  if (!atual) return;
  const irmaos = await db.routineExercise.findMany({
    where: { userId, routineId: atual.routineId },
    orderBy: { ordem: "asc" },
  });
  const i = irmaos.findIndex((e) => e.id === id);
  const j = i + direcao;
  if (j < 0 || j >= irmaos.length) return;

  await db.$transaction([
    db.routineExercise.update({
      where: { id: irmaos[i].id, userId },
      data: { ordem: irmaos[j].ordem },
    }),
    db.routineExercise.update({
      where: { id: irmaos[j].id, userId },
      data: { ordem: irmaos[i].ordem },
    }),
  ]);
  revalidar(userId);
}

// ---------- Semanas do ciclo (periodização) ----------

/**
 * Semana "atual" do ciclo, guardada em Setting. Virada é manual (o usuário
 * avança quando quiser). Nunca menor que 1.
 */
export async function setSemanaAtual(semana: number) {
  const { id: userId } = await requireUser();
  const n = Math.max(1, Math.floor(semana) || 1);
  await db.setting.upsert({
    where: { userId_key: { userId, key: "treino_ciclo_semana" } },
    create: { userId, key: "treino_ciclo_semana", value: String(n) },
    update: { value: String(n) },
  });
  revalidatePath("/treinos");
  revalidateTag(tagUsuario(userId, "settings"));
}

export type SemanaConfigInput = { series: number; repsAlvo: string; cargaAtual: number };

/**
 * Cria/atualiza o override de um exercício numa semana. Editar a semana 1
 * altera a config base (RoutineExercise), pois é a semana-template. Semanas
 * >= 2 gravam em RoutineWeekExercise — as seguintes herdam por resolução.
 */
export async function setWeekExercise(
  exerciseId: string,
  semana: number,
  input: SemanaConfigInput
) {
  const { id: userId } = await requireUser();
  const n = Math.max(1, Math.floor(semana) || 1);
  const ex = await db.routineExercise.findFirst({
    where: { id: exerciseId, userId },
    select: { id: true },
  });
  if (!ex) throw new Error("Recurso não encontrado.");

  const dados = {
    series: input.series,
    repsAlvo: input.repsAlvo,
    cargaAtual: input.cargaAtual,
  };

  if (n === 1) {
    await db.routineExercise.update({ where: { id: exerciseId, userId }, data: dados });
  } else {
    await db.routineWeekExercise.upsert({
      where: { exerciseId_semana: { exerciseId, semana: n } },
      create: { userId, exerciseId, semana: n, ...dados },
      update: dados,
    });
  }
  revalidar(userId);
}

/** Remove o override da semana → o exercício volta a herdar a semana anterior. */
export async function resetWeekExercise(exerciseId: string, semana: number) {
  const { id: userId } = await requireUser();
  const n = Math.max(2, Math.floor(semana) || 2); // semana 1 é a base, não reseta
  await db.routineWeekExercise.deleteMany({ where: { userId, exerciseId, semana: n } });
  revalidar(userId);
}

// ---------- Sessões ----------

export type SerieRealizada = { exerciseId: string; serie: number; reps: number; cargaKg: number };

export async function saveSession(input: {
  routineId: string;
  duracaoMin: number;
  notas?: string | null;
  series: SerieRealizada[];
}) {
  const { id: userId } = await requireUser();
  const rotina = await db.routine.findFirst({
    where: { id: input.routineId, userId },
    select: { id: true },
  });
  if (!rotina) throw new Error("Recurso não encontrado.");
  const exerciseIds = Array.from(new Set(input.series.map((s) => s.exerciseId)));
  if (exerciseIds.length > 0) {
    const donos = await db.routineExercise.count({
      where: { userId, id: { in: exerciseIds } },
    });
    if (donos !== exerciseIds.length) throw new Error("Recurso não encontrado.");
  }
  const sessao = await db.workoutSession.create({
    data: {
      data: new Date(),
      duracaoMin: input.duracaoMin,
      concluida: true,
      notas: input.notas?.trim() || null,
      routineId: input.routineId,
      userId,
      setLogs: {
        create: input.series.map((s) => ({
          serie: s.serie,
          reps: s.reps,
          cargaKg: s.cargaKg,
          exerciseId: s.exerciseId,
          userId,
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
    where: { userId, id: { in: Array.from(maxPorExercicio.keys()) } },
  });
  await Promise.all(
    exercicios
      .filter((e) => (maxPorExercicio.get(e.id) ?? 0) > e.cargaAtual)
      .map((e) =>
        db.routineExercise.update({
          where: { id: e.id, userId },
          data: { cargaAtual: maxPorExercicio.get(e.id)! },
        })
      )
  );

  // auto-check: item de treino do dia vinculado a esta rotina marca sozinho
  await autoCheckPlano(userId, "routineId", input.routineId, sessao.data);

  revalidar(userId);
  return sessao.id;
}

export async function deleteSession(id: string) {
  const { id: userId } = await requireUser();
  await db.workoutSession.delete({ where: { id, userId } });
  revalidar(userId);
}

// ---------- Corridas ----------

export type CorridaInput = {
  data: string; // yyyy-MM-dd
  km: number;
  segundos: number;
  tipo: string;
  sensacao: number;
  notas?: string | null;
  runSessionId?: string | null;
  stravaLink?: string | null;
};

export async function createRun(input: CorridaInput) {
  const { id: userId } = await requireUser();
  await validarPosseDaSessao(userId, input.runSessionId);
  const data = dataSP(input.data);
  await db.run.create({
    data: {
      data,
      km: input.km,
      segundos: input.segundos,
      tipo: input.tipo,
      sensacao: input.sensacao,
      notas: input.notas?.trim() || null,
      runSessionId: input.runSessionId ?? null,
      stravaLink: input.stravaLink?.trim() || null,
      userId,
    },
  });
  // auto-check: item de corrida do dia vinculado a esta sessão marca sozinho
  if (input.runSessionId) {
    await autoCheckPlano(userId, "runSessionId", input.runSessionId, data);
  }
  revalidar(userId);
}

export async function updateRun(id: string, input: CorridaInput) {
  const { id: userId } = await requireUser();
  await validarPosseDaSessao(userId, input.runSessionId);
  await db.run.update({
    where: { id, userId },
    data: {
      data: dataSP(input.data),
      km: input.km,
      segundos: input.segundos,
      tipo: input.tipo,
      sensacao: input.sensacao,
      notas: input.notas?.trim() || null,
      runSessionId: input.runSessionId ?? null,
      stravaLink: input.stravaLink?.trim() || null,
    },
  });
  revalidar(userId);
}

export async function deleteRun(id: string) {
  const { id: userId } = await requireUser();
  const corrida = await db.run.findFirst({ where: { id, userId } });
  await db.run.delete({ where: { id, userId } });
  revalidar(userId);
  return corrida;
}

export async function restoreRun(dados: {
  data: Date;
  km: number;
  segundos: number;
  tipo: string;
  sensacao: number;
  notas: string | null;
  stravaLink?: string | null;
  runSessionId?: string | null;
}) {
  const { id: userId } = await requireUser();
  // Whitelist explícita (sem spread do payload do cliente); sessão já excluída
  // ou alheia degrada para null em vez de falhar o "Desfazer".
  const sessao = dados.runSessionId
    ? await db.runSession.findFirst({
        where: { id: dados.runSessionId, userId },
        select: { id: true },
      })
    : null;
  await db.run.create({
    data: {
      data: dados.data,
      km: dados.km,
      segundos: dados.segundos,
      tipo: dados.tipo,
      sensacao: dados.sensacao,
      notas: dados.notas,
      stravaLink: dados.stravaLink ?? null,
      runSessionId: sessao?.id ?? null,
      userId,
    },
  });
  revalidar(userId);
}

// ---------- Planos de corrida (nomeados) — espelham as fichas de musculação ----------

export async function createRunRoutine(nome: string, foco: string) {
  const { id: userId } = await requireUser();
  const total = await db.runRoutine.count({ where: { userId } });
  const plano = await db.runRoutine.create({
    data: { nome, foco: foco || null, ordem: total, userId },
  });
  revalidar(userId);
  return plano.id;
}

export async function updateRunRoutine(id: string, nome: string, foco: string) {
  const { id: userId } = await requireUser();
  await db.runRoutine.update({
    where: { id, userId },
    data: { nome, foco: foco || null },
  });
  revalidar(userId);
}

export async function deleteRunRoutine(id: string) {
  const { id: userId } = await requireUser();
  await db.runRoutine.delete({ where: { id, userId } });
  revalidar(userId);
}

export async function duplicateRunRoutine(id: string) {
  const { id: userId } = await requireUser();
  const plano = await db.runRoutine.findFirst({
    where: { id, userId },
    include: {
      sessions: {
        orderBy: { ordem: "asc" },
        include: { weeks: { orderBy: { semana: "asc" } } },
      },
    },
  });
  if (!plano) return;
  await db.runRoutine.create({
    data: {
      userId,
      nome: `${plano.nome} (cópia)`,
      foco: plano.foco,
      ordem: plano.ordem + 1,
      diasSemana: plano.diasSemana,
      sessions: {
        create: plano.sessions.map((s) => ({
          userId,
          nome: s.nome,
          tipo: s.tipo,
          kmAlvo: s.kmAlvo,
          paceAlvoSeg: s.paceAlvoSeg,
          ordem: s.ordem,
          weeks: {
            create: s.weeks.map((w) => ({
              userId,
              semana: w.semana,
              kmAlvo: w.kmAlvo,
            })),
          },
        })),
      },
    },
  });
  revalidar(userId);
}

/** Dias em que o plano roda (0=dom..6=sáb). */
export async function setRunRoutineDias(routineId: string, dias: number[]) {
  const { id: userId } = await requireUser();
  const validos = Array.from(
    new Set(dias.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))
  ).sort((a, b) => a - b);
  await db.runRoutine.update({
    where: { id: routineId, userId },
    data: { diasSemana: JSON.stringify(validos.map(String)) },
  });
  revalidar(userId);
}

// ---------- Sessões do plano de corrida (espelham os exercícios) ----------

export type RunSessionInput = {
  nome: string;
  tipo: string;
  kmAlvo: number;
};

export async function createRunSession(routineId: string, input: RunSessionInput) {
  const { id: userId } = await requireUser();
  const plano = await db.runRoutine.findFirst({
    where: { id: routineId, userId },
    select: { id: true },
  });
  if (!plano) throw new Error("Recurso não encontrado.");
  const total = await db.runSession.count({ where: { userId, routineId } });
  await db.runSession.create({
    data: {
      nome: input.nome.trim() || input.tipo,
      tipo: input.tipo,
      kmAlvo: input.kmAlvo,
      routineId,
      ordem: total,
      userId,
    },
  });
  revalidar(userId);
}

export async function updateRunSession(id: string, input: RunSessionInput) {
  const { id: userId } = await requireUser();
  await db.runSession.update({
    where: { id, userId },
    data: {
      nome: input.nome.trim() || input.tipo,
      tipo: input.tipo,
      kmAlvo: input.kmAlvo,
    },
  });
  revalidar(userId);
}

/** Metadados que NÃO variam por semana (nome, tipo). O km-alvo vai p/ o override. */
export async function updateRunSessionMeta(
  id: string,
  input: Pick<RunSessionInput, "nome" | "tipo">
) {
  const { id: userId } = await requireUser();
  await db.runSession.update({
    where: { id, userId },
    data: { nome: input.nome.trim() || input.tipo, tipo: input.tipo },
  });
  revalidar(userId);
}

export async function deleteRunSession(id: string) {
  const { id: userId } = await requireUser();
  await db.runSession.delete({ where: { id, userId } });
  revalidar(userId);
}

export async function moveRunSession(id: string, direcao: -1 | 1) {
  const { id: userId } = await requireUser();
  const atual = await db.runSession.findFirst({ where: { id, userId } });
  if (!atual) return;
  const irmaos = await db.runSession.findMany({
    where: { userId, routineId: atual.routineId },
    orderBy: { ordem: "asc" },
  });
  const i = irmaos.findIndex((s) => s.id === id);
  const j = i + direcao;
  if (j < 0 || j >= irmaos.length) return;

  await db.$transaction([
    db.runSession.update({
      where: { id: irmaos[i].id, userId },
      data: { ordem: irmaos[j].ordem },
    }),
    db.runSession.update({
      where: { id: irmaos[j].id, userId },
      data: { ordem: irmaos[i].ordem },
    }),
  ]);
  revalidar(userId);
}

/**
 * Km-alvo de uma sessão numa semana do ciclo. Editar a semana 1 altera a base
 * (RunSession.kmAlvo). Semanas >= 2 gravam em RunSessionWeek; as seguintes
 * herdam por resolução (weekConfig). Espelha setWeekExercise.
 */
export async function setRunSessionWeek(
  sessionId: string,
  semana: number,
  kmAlvo: number
) {
  const { id: userId } = await requireUser();
  const n = Math.max(1, Math.floor(semana) || 1);
  const sessao = await db.runSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true },
  });
  if (!sessao) throw new Error("Recurso não encontrado.");

  if (n === 1) {
    await db.runSession.update({ where: { id: sessionId, userId }, data: { kmAlvo } });
  } else {
    await db.runSessionWeek.upsert({
      where: { sessionId_semana: { sessionId, semana: n } },
      create: { userId, sessionId, semana: n, kmAlvo },
      update: { kmAlvo },
    });
  }
  revalidar(userId);
}

/** Remove o override da semana → a sessão volta a herdar a semana anterior. */
export async function resetRunSessionWeek(sessionId: string, semana: number) {
  const { id: userId } = await requireUser();
  const n = Math.max(2, Math.floor(semana) || 2); // semana 1 é a base
  await db.runSessionWeek.deleteMany({ where: { userId, sessionId, semana: n } });
  revalidar(userId);
}
