"use server";

import { revalidatePath, revalidateTag } from "@/lib/cache-revalidate";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { tagUsuario } from "@/lib/cache-tags";
import { dayKeySP, spStartOfDay } from "@/lib/dates";
import { marcarDiaAtivo } from "@/lib/streak";
import { templateOcorreNoDia } from "@/lib/rotina-helpers";
import { modalidadeDe, type ModalidadeCardio } from "@/lib/data/treinos-format";

function revalidar(userId: string) {
  revalidatePath("/treinos");
  revalidatePath("/");
  // toda mutação escreve tabelas de treinos → derruba o cache do módulo
  revalidateTag(tagUsuario(userId, "treinos"));
}

function dataSP(dia: string): Date {
  return new Date(`${dia}T12:00:00-03:00`);
}

/** Garante que a sessão de cardio referenciada pertence ao usuário. */
async function validarPosseDaSessao(userId: string, runSessionId?: string | null) {
  if (!runSessionId) return;
  const sessao = await db.runSession.findFirst({
    where: { id: runSessionId, userId },
    select: { id: true },
  });
  if (!sessao) throw new Error("Recurso não encontrado.");
}

/**
 * Modalidade efetiva de um registro: a da sessão do plano, quando há vínculo.
 * Uma pedalada não pode ser gravada como "corrida" só porque o formulário veio
 * de outra aba — o plano manda, e é ele que decide onde o registro aparece.
 */
async function modalidadeDoRegistro(
  userId: string,
  runSessionId: string | null | undefined,
  informada: string | undefined
): Promise<ModalidadeCardio> {
  if (runSessionId) {
    const sessao = await db.runSession.findFirst({
      where: { id: runSessionId, userId },
      select: { routine: { select: { modalidade: true } } },
    });
    if (sessao) return modalidadeDe(sessao.routine.modalidade);
  }
  return modalidadeDe(informada);
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
      exercises: { orderBy: { ordem: "asc" } },
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
          semana: e.semana,
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

export async function createExercise(
  routineId: string,
  semana: number,
  input: ExercicioInput
) {
  const { id: userId } = await requireUser();
  const rotina = await db.routine.findFirst({
    where: { id: routineId, userId },
    select: { id: true },
  });
  if (!rotina) throw new Error("Recurso não encontrado.");
  const n = Math.max(1, Math.floor(semana) || 1);
  const total = await db.routineExercise.count({ where: { userId, routineId, semana: n } });
  await db.routineExercise.create({
    data: {
      ...input,
      tipoAlvo: input.tipoAlvo ?? "series",
      tempoAlvoSeg: input.tempoAlvoSeg ?? 60,
      observacao: input.observacao?.trim() || null,
      routineId,
      semana: n,
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

export async function deleteExercise(id: string) {
  const { id: userId } = await requireUser();
  await db.routineExercise.delete({ where: { id, userId } });
  revalidar(userId);
}

/** Troca a ordem do exercício com o vizinho na MESMA semana (direcao -1 = sobe, 1 = desce). */
export async function moveExercise(id: string, direcao: -1 | 1) {
  const { id: userId } = await requireUser();
  const atual = await db.routineExercise.findFirst({ where: { id, userId } });
  if (!atual) return;
  const irmaos = await db.routineExercise.findMany({
    where: { userId, routineId: atual.routineId, semana: atual.semana },
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

/**
 * Clona todas as linhas da semana de origem para a semana de destino — atalho
 * pra não montar do zero uma semana nova. Recusa se o destino já tiver
 * conteúdo (evita duplicar por engano).
 */
export async function duplicarSemanaExercicios(
  routineId: string,
  semanaOrigem: number,
  semanaDestino: number
) {
  const { id: userId } = await requireUser();
  const rotina = await db.routine.findFirst({
    where: { id: routineId, userId },
    select: { id: true },
  });
  if (!rotina) throw new Error("Recurso não encontrado.");

  const jaTemConteudo = await db.routineExercise.count({
    where: { userId, routineId, semana: semanaDestino },
  });
  if (jaTemConteudo > 0) throw new Error(`A semana ${semanaDestino} já tem exercícios.`);

  const origem = await db.routineExercise.findMany({
    where: { userId, routineId, semana: semanaOrigem },
    orderBy: { ordem: "asc" },
  });
  if (origem.length === 0) return;

  await db.routineExercise.createMany({
    data: origem.map((e) => ({
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
      routineId,
      semana: semanaDestino,
    })),
  });
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

  await marcarDiaAtivo(userId, dayKeySP(sessao.data)); // conquista o dia
  revalidar(userId);
  return sessao.id;
}

export async function deleteSession(id: string) {
  const { id: userId } = await requireUser();
  const sessao = await db.workoutSession.findFirst({
    where: { id, userId },
    include: { setLogs: true },
  });
  if (!sessao) return null;
  await db.workoutSession.delete({ where: { id, userId } });
  revalidar(userId);
  return sessao;
}

export async function restoreSession(dados: {
  data: Date;
  duracaoMin: number;
  notas: string | null;
  routineId: string | null;
  setLogs: { serie: number; reps: number; cargaKg: number; exerciseId: string }[];
}) {
  const { id: userId } = await requireUser();
  // Whitelist explícita (sem spread do payload do cliente); ficha já excluída
  // ou alheia degrada para null em vez de falhar o "Desfazer".
  const rotina = dados.routineId
    ? await db.routine.findFirst({ where: { id: dados.routineId, userId }, select: { id: true } })
    : null;
  const exerciseIds = Array.from(new Set(dados.setLogs.map((s) => s.exerciseId)));
  const exerciciosValidos =
    exerciseIds.length > 0
      ? new Set(
          (
            await db.routineExercise.findMany({
              where: { userId, id: { in: exerciseIds } },
              select: { id: true },
            })
          ).map((e) => e.id)
        )
      : new Set<string>();

  await db.workoutSession.create({
    data: {
      data: dados.data,
      duracaoMin: dados.duracaoMin,
      concluida: true,
      notas: dados.notas,
      routineId: rotina?.id ?? null,
      userId,
      setLogs: {
        create: dados.setLogs
          .filter((s) => exerciciosValidos.has(s.exerciseId))
          .map((s) => ({
            serie: s.serie,
            reps: s.reps,
            cargaKg: s.cargaKg,
            exerciseId: s.exerciseId,
            userId,
          })),
      },
    },
  });
  revalidar(userId);
}

// ---------- Sessões de cardio (corrida / natação / ciclismo) ----------
// Um único conjunto de actions serve as três modalidades: `modalidade` só
// decide em qual aba o registro aparece e com que unidade é exibido. `km` é
// sempre a unidade de armazenamento — a UI converte metros ↔ km na natação.

export type CorridaInput = {
  data: string; // yyyy-MM-dd
  km: number;
  segundos: number;
  tipo: string;
  /** "corrida" (padrão) | "natacao" | "ciclismo" */
  modalidade?: ModalidadeCardio;
  sensacao: number;
  notas?: string | null;
  runSessionId?: string | null;
  stravaLink?: string | null;
  stravaActivityId?: string | null;
  /** false quando o registro não deve contar em metas/desafios (ex.: caminhada lançada como corrida). */
  quantificar?: boolean;
};

export async function createRun(input: CorridaInput) {
  const { id: userId } = await requireUser();
  await validarPosseDaSessao(userId, input.runSessionId);
  const modalidade = await modalidadeDoRegistro(
    userId,
    input.runSessionId,
    input.modalidade
  );

  if (input.stravaActivityId) {
    const jaExiste = await db.run.findFirst({
      where: { userId, stravaActivityId: input.stravaActivityId },
      select: { id: true },
    });
    if (jaExiste) throw new Error("Esta atividade do Strava já foi importada.");
  }

  const data = dataSP(input.data);
  const run = await db.run.create({
    data: {
      data,
      km: input.km,
      segundos: input.segundos,
      tipo: input.tipo,
      modalidade,
      sensacao: input.sensacao,
      notas: input.notas?.trim() || null,
      runSessionId: input.runSessionId ?? null,
      stravaLink: input.stravaLink?.trim() || null,
      stravaActivityId: input.stravaActivityId ?? null,
      quantificar: input.quantificar ?? true,
      userId,
    },
  });
  // auto-check: item do dia vinculado a esta sessão marca sozinho
  if (input.runSessionId) {
    await autoCheckPlano(userId, "runSessionId", input.runSessionId, data);
  }
  await marcarDiaAtivo(userId, dayKeySP(data)); // conquista o dia
  revalidar(userId);
  return run.id;
}

export async function updateRun(id: string, input: CorridaInput) {
  const { id: userId } = await requireUser();
  await validarPosseDaSessao(userId, input.runSessionId);
  const modalidade = await modalidadeDoRegistro(
    userId,
    input.runSessionId,
    input.modalidade
  );

  if (input.stravaActivityId) {
    const jaExiste = await db.run.findFirst({
      where: { userId, stravaActivityId: input.stravaActivityId, NOT: { id } },
      select: { id: true },
    });
    if (jaExiste) throw new Error("Esta atividade do Strava já foi importada.");
  }

  await db.run.update({
    where: { id, userId },
    data: {
      data: dataSP(input.data),
      km: input.km,
      segundos: input.segundos,
      tipo: input.tipo,
      modalidade,
      sensacao: input.sensacao,
      notas: input.notas?.trim() || null,
      runSessionId: input.runSessionId ?? null,
      stravaLink: input.stravaLink?.trim() || null,
      stravaActivityId: input.stravaActivityId ?? null,
      quantificar: input.quantificar ?? true,
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
  modalidade?: string | null;
  sensacao: number;
  notas: string | null;
  stravaLink?: string | null;
  runSessionId?: string | null;
  quantificar?: boolean;
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
      modalidade: modalidadeDe(dados.modalidade),
      sensacao: dados.sensacao,
      notas: dados.notas,
      stravaLink: dados.stravaLink ?? null,
      runSessionId: sessao?.id ?? null,
      quantificar: dados.quantificar ?? true,
      userId,
    },
  });
  revalidar(userId);
}

// ---------- Planos de cardio (nomeados) — espelham as fichas de musculação ----------
// A modalidade é escolhida na criação e nunca muda: trocá-la depois moveria o
// plano de aba deixando para trás as sessões já registradas na antiga.

export async function createRunRoutine(
  nome: string,
  foco: string,
  modalidade: ModalidadeCardio = "corrida"
) {
  const { id: userId } = await requireUser();
  const total = await db.runRoutine.count({ where: { userId } });
  const plano = await db.runRoutine.create({
    data: {
      nome,
      foco: foco || null,
      modalidade: modalidadeDe(modalidade),
      ordem: total,
      userId,
    },
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
      sessions: { orderBy: { ordem: "asc" } },
    },
  });
  if (!plano) return;
  await db.runRoutine.create({
    data: {
      userId,
      nome: `${plano.nome} (cópia)`,
      foco: plano.foco,
      modalidade: plano.modalidade,
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
          semana: s.semana,
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

export async function createRunSession(
  routineId: string,
  semana: number,
  input: RunSessionInput
) {
  const { id: userId } = await requireUser();
  const plano = await db.runRoutine.findFirst({
    where: { id: routineId, userId },
    select: { id: true },
  });
  if (!plano) throw new Error("Recurso não encontrado.");
  const n = Math.max(1, Math.floor(semana) || 1);
  const total = await db.runSession.count({ where: { userId, routineId, semana: n } });
  await db.runSession.create({
    data: {
      nome: input.nome.trim() || input.tipo,
      tipo: input.tipo,
      kmAlvo: input.kmAlvo,
      routineId,
      semana: n,
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

export async function deleteRunSession(id: string) {
  const { id: userId } = await requireUser();
  await db.runSession.delete({ where: { id, userId } });
  revalidar(userId);
}

/** Troca a ordem da sessão com a vizinha na MESMA semana. */
export async function moveRunSession(id: string, direcao: -1 | 1) {
  const { id: userId } = await requireUser();
  const atual = await db.runSession.findFirst({ where: { id, userId } });
  if (!atual) return;
  const irmaos = await db.runSession.findMany({
    where: { userId, routineId: atual.routineId, semana: atual.semana },
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
 * Clona as sessões da semana de origem para a semana de destino — atalho pra
 * não montar do zero. Também reaponta qualquer item do checklist vinculado às
 * sessões de origem para as cópias novas, senão o auto-check "toda terça, faça
 * o longão" perderia o vínculo a cada semana nova.
 */
export async function duplicarSemanaSessoes(
  routineId: string,
  semanaOrigem: number,
  semanaDestino: number
) {
  const { id: userId } = await requireUser();
  const plano = await db.runRoutine.findFirst({
    where: { id: routineId, userId },
    select: { id: true },
  });
  if (!plano) throw new Error("Recurso não encontrado.");

  const jaTemConteudo = await db.runSession.count({
    where: { userId, routineId, semana: semanaDestino },
  });
  if (jaTemConteudo > 0) throw new Error(`A semana ${semanaDestino} já tem sessões.`);

  const origem = await db.runSession.findMany({
    where: { userId, routineId, semana: semanaOrigem },
    orderBy: { ordem: "asc" },
  });
  if (origem.length === 0) return;

  const copias = await db.$transaction(
    origem.map((s) =>
      db.runSession.create({
        data: {
          userId,
          nome: s.nome,
          tipo: s.tipo,
          kmAlvo: s.kmAlvo,
          paceAlvoSeg: s.paceAlvoSeg,
          ordem: s.ordem,
          routineId,
          semana: semanaDestino,
        },
      })
    )
  );

  await Promise.all(
    origem.map((s, i) =>
      db.rotinaTemplate.updateMany({
        where: { userId, runSessionId: s.id },
        data: { runSessionId: copias[i].id },
      })
    )
  );

  revalidar(userId);
}
