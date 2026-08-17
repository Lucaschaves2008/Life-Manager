import {
  cacheLife,
  cacheTag,
} from "next/cache";
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { db } from "@/lib/db";
import { tagUsuario } from "@/lib/cache-tags";
import {
  MODALIDADE,
  MODALIDADES_CARDIO,
  modalidadeDe,
  paraKm,
  somarKmNoPeriodo,
  type ModalidadeCardio,
  type PlanoCorridaView,
  type SessaoCorridaOpcao,
} from "./treinos-format";
import {
  dayKeySP,
  monthName,
  refDoDiaSP,
  shortDate,
  spEndOfDay,
  spEndOfMonth,
  spEndOfWeek,
  spStartOfDay,
  spStartOfMonth,
  spStartOfWeek,
  toSP,
} from "@/lib/dates";

// Padrão de cache (ver lib/data/home.ts): a função exportada mantém a
// assinatura original (userId, ref?) e delega para uma interna "use cache"
// com chaves ESTÁVEIS (userId + dayKey) — nunca um Date de request.

// Formatadores puros vivem em treinos-format.ts (client-safe); o re-export
// mantém os call sites server deste módulo intactos.
export {
  formatDuracao,
  formatPace,
  formatTonelagem,
  formatDiasSemana,
  formatDistanciaMod,
  formatRitmo,
  MODALIDADE,
  MODALIDADES_CARDIO,
} from "./treinos-format";
export type {
  ModalidadeCardio,
  PlanoCorridaView,
  SessaoCorridaView,
  SessaoCorridaOpcao,
} from "./treinos-format";
/** Semana atual do ciclo (Setting; virada manual). Mín. 1. */
export async function semanaCicloAtual(userId: string): Promise<number> {
  "use cache";
  cacheTag(tagUsuario(userId, "settings"));
  cacheLife("usuario");

  const s = await db.setting.findUnique({
    where: { userId_key: { userId, key: "treino_ciclo_semana" } },
  });
  return Math.max(1, Number(s?.value ?? 1) || 1);
}

export type FrequenciaCell = { key: string; value: number; label: string };

/** Frequência dos últimos N dias: sessões + corridas por dia. */
export async function frequencia(
  userId: string,
  dias = 119,
  ref: Date = new Date()
): Promise<FrequenciaCell[]> {
  return frequenciaDoDia(userId, dias, dayKeySP(ref));
}

async function frequenciaDoDia(
  userId: string,
  dias: number,
  dia: string
): Promise<FrequenciaCell[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "treinos"));
  cacheLife("usuario");

  const ref = refDoDiaSP(dia);
  const de = spStartOfDay(subDays(toSP(ref), dias));
  const [sessoes, corridas] = await Promise.all([
    db.workoutSession.findMany({
      where: { userId, data: { gte: de, lte: spEndOfDay(ref) } },
      select: { data: true },
    }),
    db.run.findMany({
      where: { userId, data: { gte: de, lte: spEndOfDay(ref) } },
      select: { data: true },
    }),
  ]);

  const contagem = new Map<string, number>();
  for (const item of [...sessoes, ...corridas]) {
    const k = dayKeySP(item.data);
    contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }

  return eachDayOfInterval({ start: de, end: toSP(ref) }).map((dia) => {
    const key = dayKeySP(dia);
    const value = contagem.get(key) ?? 0;
    return {
      key,
      value,
      label: `${shortDate(dia)}: ${value} ${value === 1 ? "treino" : "treinos"}`,
    };
  });
}

/** Volume da semana numa modalidade: km brutos + nº de sessões registradas. */
export type VolumeModalidade = { km: number; sessoes: number };

export type ResumoTreinos = {
  treinosMes: number;
  metaMes: number;
  pctMeta: number;
  streak: number;
  tonelagemSemana: number;
  /** Km corridos na semana (só modalidade "corrida" — mantido p/ compatibilidade). */
  kmSemana: number;
  /** Volume da semana por modalidade de cardio, em km brutos. */
  porModalidade: Record<ModalidadeCardio, VolumeModalidade>;
  porGrupo: { grupo: string; series: number }[];
};

export async function resumoTreinos(
  userId: string,
  ref: Date = new Date()
): Promise<ResumoTreinos> {
  return resumoTreinosDoDia(userId, dayKeySP(ref));
}

async function resumoTreinosDoDia(
  userId: string,
  dia: string
): Promise<ResumoTreinos> {
  "use cache";
  // lê tabelas de treinos + Setting (meta_treinos_mes)
  cacheTag(tagUsuario(userId, "treinos"), tagUsuario(userId, "settings"));
  cacheLife("usuario");

  const ref = refDoDiaSP(dia);
  const iniMes = spStartOfMonth(ref);
  const fimMes = spEndOfMonth(ref);
  const iniSemana = spStartOfWeek(ref);
  const fimSemana = spEndOfWeek(ref);

  const [sessoesMes, corridasMes, sessoesSemana, corridasSemana, metaSetting, setLogsMes] =
    await Promise.all([
      db.workoutSession.count({ where: { userId, data: { gte: iniMes, lte: fimMes } } }),
      db.run.count({ where: { userId, data: { gte: iniMes, lte: fimMes } } }),
      db.workoutSession.findMany({
        where: { userId, data: { gte: iniSemana, lte: fimSemana } },
        include: { setLogs: true },
      }),
      db.run.findMany({ where: { userId, data: { gte: iniSemana, lte: fimSemana } } }),
      db.setting.findUnique({ where: { userId_key: { userId, key: "meta_treinos_mes" } } }),
      db.setLog.findMany({
        where: { userId, session: { data: { gte: iniMes, lte: fimMes } } },
        select: { exercise: { select: { grupoMuscular: true } } },
      }),
    ]);

  const metaMes = Number(metaSetting?.value ?? 16) || 16;
  const treinosMes = sessoesMes + corridasMes;

  const tonelagemSemana = sessoesSemana.reduce(
    (s, sessao) => s + sessao.setLogs.reduce((t, log) => t + log.reps * log.cargaKg, 0),
    0
  );
  // Uma passada só sobre as corridas da semana, bucketizada por modalidade —
  // evita 3 queries (ou 3 reduces) para a mesma janela.
  const porModalidade = Object.fromEntries(
    MODALIDADES_CARDIO.map((m) => {
      const doTipo = corridasSemana.filter((c) => modalidadeDe(c.modalidade) === m);
      return [m, { km: somarKmNoPeriodo(doTipo, iniSemana, fimSemana), sessoes: doTipo.length }];
    })
  ) as Record<ModalidadeCardio, VolumeModalidade>;

  const grupos = new Map<string, number>();
  for (const log of setLogsMes) {
    const g = log.exercise.grupoMuscular;
    grupos.set(g, (grupos.get(g) ?? 0) + 1);
  }

  return {
    treinosMes,
    metaMes,
    pctMeta: metaMes > 0 ? (treinosMes / metaMes) * 100 : 0,
    streak: await streakDeTreino(userId, ref),
    tonelagemSemana,
    kmSemana: porModalidade.corrida.km,
    porModalidade,
    porGrupo: Array.from(grupos.entries())
      .map(([grupo, series]) => ({ grupo, series }))
      .sort((a, b) => b.series - a.series),
  };
}

/** Dias consecutivos (contando de hoje/ontem para trás) com sessão ou corrida. */
async function streakDeTreino(userId: string, ref: Date): Promise<number> {
  const de = subDays(toSP(ref), 120);
  const [sessoes, corridas] = await Promise.all([
    db.workoutSession.findMany({
      where: { userId, data: { gte: de } },
      select: { data: true },
    }),
    db.run.findMany({ where: { userId, data: { gte: de } }, select: { data: true } }),
  ]);
  const dias = new Set(
    [...sessoes, ...corridas].map((x) => dayKeySP(x.data))
  );

  let streak = 0;
  for (let i = 0; i < 120; i++) {
    const dia = dayKeySP(subDays(toSP(ref), i));
    if (dias.has(dia)) streak++;
    else if (i > 0) break;
  }
  return streak;
}

export type VolumeSemana = { label: string; km: number; atual: boolean };

/** Km por semana nas últimas N semanas, numa modalidade. */
export async function volumeSemanal(
  userId: string,
  semanas = 8,
  ref: Date = new Date(),
  modalidade: ModalidadeCardio = "corrida"
): Promise<VolumeSemana[]> {
  return volumeSemanalDoDia(userId, semanas, dayKeySP(ref), modalidade);
}

async function volumeSemanalDoDia(
  userId: string,
  semanas: number,
  dia: string,
  modalidade: ModalidadeCardio
): Promise<VolumeSemana[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "treinos"));
  cacheLife("usuario");

  const ref = refDoDiaSP(dia);
  const de = spStartOfWeek(subWeeks(toSP(ref), semanas - 1));
  const corridas = await db.run.findMany({
    where: { userId, modalidade, data: { gte: de, lte: spEndOfDay(ref) } },
  });

  const out: VolumeSemana[] = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const inicio = spStartOfWeek(subWeeks(toSP(ref), i));
    const fim = spEndOfWeek(subWeeks(toSP(ref), i));
    const km = somarKmNoPeriodo(corridas, inicio, fim);
    out.push({ label: shortDate(inicio).slice(0, 5), km, atual: i === 0 });
  }
  return out;
}

export type Recorde = { distancia: string; tempo: number; data: Date } | null;

/**
 * Melhor tempo projetado nas duas distâncias-referência da modalidade
 * (corrida 5/10 km, natação 400/1500 m, ciclismo 20/40 km). A projeção usa
 * sessões cuja distância ficou entre o alvo e 30% acima dele — o mesmo critério
 * de antes (5–6,5 km), agora derivado do alvo em vez de fixo.
 */
export async function recordes(
  userId: string,
  modalidade: ModalidadeCardio = "corrida"
): Promise<{ curta: Recorde; longa: Recorde }> {
  "use cache";
  cacheTag(tagUsuario(userId, "treinos"));
  cacheLife("usuario");

  const meta = MODALIDADE[modalidade];
  // alvos convertidos p/ km, que é como a distância é armazenada
  const alvos = meta.recordes.map((d) => paraKm(d, modalidade)) as [number, number];
  const teto = (alvo: number) => alvo * 1.3;

  const corridas = await db.run.findMany({
    where: {
      userId,
      modalidade,
      OR: alvos.map((alvo) => ({ km: { gte: alvo, lte: teto(alvo) } })),
    },
    select: { km: true, segundos: true, data: true },
  });

  const melhor = (alvo: number, rotulo: number): Recorde => {
    const candidatas = corridas.filter((c) => c.km >= alvo && c.km <= teto(alvo));
    if (candidatas.length === 0) return null;
    const projetadas = candidatas.map((c) => ({
      tempo: Math.round((c.segundos / c.km) * alvo),
      data: c.data,
    }));
    projetadas.sort((a, b) => a.tempo - b.tempo);
    return {
      distancia: `${rotulo.toLocaleString("pt-BR")} ${meta.unidade}`,
      tempo: projetadas[0].tempo,
      data: projetadas[0].data,
    };
  };

  return {
    curta: melhor(alvos[0], meta.recordes[0]),
    longa: melhor(alvos[1], meta.recordes[1]),
  };
}

export type ProgressaoPonto = {
  label: string;
  cargaMax: number;
  volume: number;
  pr: boolean;
};

/** Progressão de carga e volume de um exercício, sessão a sessão. */
export async function progressaoDoExercicio(
  userId: string,
  exerciseId: string
): Promise<ProgressaoPonto[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "treinos"));
  cacheLife("usuario");

  const logs = await db.setLog.findMany({
    where: { userId, exerciseId },
    include: { session: true },
    orderBy: { session: { data: "asc" } },
  });

  const porSessao = new Map<string, { data: Date; cargaMax: number; volume: number }>();
  for (const log of logs) {
    const atual = porSessao.get(log.sessionId);
    porSessao.set(log.sessionId, {
      data: log.session.data,
      cargaMax: Math.max(atual?.cargaMax ?? 0, log.cargaKg),
      volume: (atual?.volume ?? 0) + log.reps * log.cargaKg,
    });
  }

  const pontos = Array.from(porSessao.values()).sort(
    (a, b) => a.data.getTime() - b.data.getTime()
  );

  let recorde = 0;
  return pontos.map((p) => {
    const pr = p.cargaMax > recorde;
    if (pr) recorde = p.cargaMax;
    return {
      label: shortDate(p.data),
      cargaMax: p.cargaMax,
      volume: Math.round(p.volume),
      pr,
    };
  });
}

/** Dias desde o último treino (para textos de contexto). */
export async function diasDesdeUltimoTreino(
  userId: string,
  ref: Date = new Date()
): Promise<number | null> {
  return diasDesdeUltimoTreinoDoDia(userId, dayKeySP(ref));
}

async function diasDesdeUltimoTreinoDoDia(
  userId: string,
  dia: string
): Promise<number | null> {
  "use cache";
  cacheTag(tagUsuario(userId, "treinos"));
  cacheLife("usuario");

  const ref = refDoDiaSP(dia);
  const ultima = await db.workoutSession.findFirst({
    where: { userId },
    orderBy: { data: "desc" },
  });
  if (!ultima) return null;
  return differenceInCalendarDays(toSP(ref), toSP(ultima.data));
}

// ---------- Planos de cardio (nomeados, com semanas independentes) ----------
// Espelha a estrutura da musculação: plano → sessões da semana ativa. Cruza
// com as corridas da semana para marcar o que já foi cumprido. Vale igual
// para corrida, natação e ciclismo — só o filtro de modalidade muda.

/** Planos de uma modalidade, resolvidos para a semana do ciclo atual. */
export async function planosCorrida(
  userId: string,
  ref: Date = new Date(),
  modalidade: ModalidadeCardio = "corrida"
): Promise<PlanoCorridaView[]> {
  const semana = await semanaCicloAtual(userId);
  return planosCorridaDoDia(userId, semana, dayKeySP(ref), modalidade);
}

async function planosCorridaDoDia(
  userId: string,
  semana: number,
  dia: string,
  modalidade: ModalidadeCardio
): Promise<PlanoCorridaView[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "treinos"));
  cacheLife("usuario");

  const ref = refDoDiaSP(dia);
  const inicio = spStartOfWeek(ref);
  const fim = spEndOfWeek(ref);

  const [planos, runs] = await Promise.all([
    db.runRoutine.findMany({
      where: { userId, modalidade },
      orderBy: { ordem: "asc" },
      include: {
        sessions: { orderBy: { ordem: "asc" } },
      },
    }),
    db.run.findMany({
      where: { userId, modalidade, data: { gte: inicio, lte: fim } },
      orderBy: { data: "asc" },
    }),
  ]);

  // corrida cumprida por sessão: a primeira run da semana vinculada àquela sessão
  const runPorSessao = new Map<string, (typeof runs)[number]>();
  for (const r of runs) {
    if (r.runSessionId && !runPorSessao.has(r.runSessionId)) {
      runPorSessao.set(r.runSessionId, r);
    }
  }

  return planos.map((p) => {
    const semanasComConteudo = Array.from(new Set(p.sessions.map((s) => s.semana))).sort(
      (a, b) => a - b
    );
    return {
      id: p.id,
      nome: p.nome,
      foco: p.foco,
      modalidade: modalidadeDe(p.modalidade),
      diasSemana: parseDias(p.diasSemana),
      semanasComConteudo,
      sessoes: p.sessions
        .filter((s) => s.semana === semana)
        .map((s) => {
          const run = runPorSessao.get(s.id) ?? null;
          return {
            id: s.id,
            nome: s.nome,
            tipo: s.tipo,
            kmAlvo: s.kmAlvo,
            semana: s.semana,
            cumprida: run ? { id: run.id, km: run.km, segundos: run.segundos } : null,
          };
        }),
    };
  });
}

function parseDias(raw: string): number[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(Number).filter((n) => n >= 0 && n <= 6) : [];
  } catch {
    return [];
  }
}

export type ExercicioHojeView = {
  id: string;
  nome: string;
  grupoMuscular: string;
  metodo: string;
  tipoAlvo: string;
  series: number;
  repsAlvo: string;
  cargaAtual: number;
  tempoAlvoSeg: number;
  descansoSeg: number;
  observacao: string | null;
};

export type FichaHojeView = {
  tipo: "musculacao";
  id: string;
  nome: string;
  foco: string | null;
  semana: number;
  exercicios: ExercicioHojeView[];
  feito: boolean;
  /** WorkoutSession.id que marcou feito hoje — usado pra "Desfazer". */
  registroId: string | null;
};

export type SessaoCorridaHojeView = {
  tipo: "cardio";
  /** Qual modalidade — decide ícone, unidade e rótulos na UI. */
  modalidade: ModalidadeCardio;
  id: string;
  planoId: string;
  planoNome: string;
  nome: string;
  tipoSessao: string;
  kmAlvo: number;
  semana: number;
  feito: boolean;
  /** Run.id que marcou feito hoje — usado pra "Desfazer". */
  registroId: string | null;
};

export type TreinoHojeView = FichaHojeView | SessaoCorridaHojeView;

/** Fichas de musculação e sessões de cardio agendadas para o dia da semana de hoje. */
export async function treinosDeHoje(
  userId: string,
  ref: Date = new Date()
): Promise<TreinoHojeView[]> {
  const semana = await semanaCicloAtual(userId);
  return treinosDeHojeDoDia(userId, semana, dayKeySP(ref));
}

async function treinosDeHojeDoDia(
  userId: string,
  semana: number,
  dia: string
): Promise<TreinoHojeView[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "treinos"));
  cacheLife("usuario");

  const ref = refDoDiaSP(dia);
  const diaSemana = toSP(ref).getDay();
  const inicioDia = spStartOfDay(ref);
  const fimDia = spEndOfDay(ref);

  const [rotinas, planos] = await Promise.all([
    db.routine.findMany({
      where: { userId },
      orderBy: { ordem: "asc" },
      include: {
        exercises: { where: { semana }, orderBy: { ordem: "asc" } },
      },
    }),
    db.runRoutine.findMany({
      where: { userId },
      orderBy: { ordem: "asc" },
      include: {
        sessions: { where: { semana }, orderBy: { ordem: "asc" } },
      },
    }),
  ]);

  const rotinasHoje = rotinas.filter((r) => parseDias(r.diasSemana).includes(diaSemana));
  const planosHoje = planos.filter((p) => parseDias(p.diasSemana).includes(diaSemana));
  const routineIds = rotinasHoje.map((r) => r.id);
  const sessionIds = planosHoje.flatMap((p) => p.sessions.map((s) => s.id));

  // "Feito hoje" é por DIA, não por semana — uma ficha recorrente seg/qua
  // marcada na segunda não pode sumir da lista de quarta.
  const [sessoesFeitas, runsFeitos] = await Promise.all([
    routineIds.length > 0
      ? db.workoutSession.findMany({
          where: { userId, routineId: { in: routineIds }, data: { gte: inicioDia, lte: fimDia } },
          select: { id: true, routineId: true },
        })
      : Promise.resolve([]),
    sessionIds.length > 0
      ? db.run.findMany({
          where: {
            userId,
            runSessionId: { in: sessionIds },
            data: { gte: inicioDia, lte: fimDia },
          },
          select: { id: true, runSessionId: true },
        })
      : Promise.resolve([]),
  ]);

  const sessaoFeitaPorRotina = new Map<string, string>();
  for (const s of sessoesFeitas) {
    if (s.routineId && !sessaoFeitaPorRotina.has(s.routineId)) {
      sessaoFeitaPorRotina.set(s.routineId, s.id);
    }
  }
  const runFeitoPorSessao = new Map<string, string>();
  for (const r of runsFeitos) {
    if (r.runSessionId && !runFeitoPorSessao.has(r.runSessionId)) {
      runFeitoPorSessao.set(r.runSessionId, r.id);
    }
  }

  const fichas: FichaHojeView[] = rotinasHoje.map((r) => ({
    tipo: "musculacao" as const,
    id: r.id,
    nome: r.nome,
    foco: r.foco,
    semana,
    exercicios: r.exercises.map((e) => ({
      id: e.id,
      nome: e.nome,
      grupoMuscular: e.grupoMuscular,
      metodo: e.metodo,
      tipoAlvo: e.tipoAlvo,
      series: e.series,
      repsAlvo: e.repsAlvo,
      cargaAtual: e.cargaAtual,
      tempoAlvoSeg: e.tempoAlvoSeg,
      descansoSeg: e.descansoSeg,
      observacao: e.observacao,
    })),
    feito: sessaoFeitaPorRotina.has(r.id),
    registroId: sessaoFeitaPorRotina.get(r.id) ?? null,
  }));

  const sessoesCardio: SessaoCorridaHojeView[] = planosHoje.flatMap((p) =>
    p.sessions.map((s) => ({
      tipo: "cardio" as const,
      modalidade: modalidadeDe(p.modalidade),
      id: s.id,
      planoId: p.id,
      planoNome: p.nome,
      nome: s.nome,
      tipoSessao: s.tipo,
      kmAlvo: s.kmAlvo,
      semana,
      feito: runFeitoPorSessao.has(s.id),
      registroId: runFeitoPorSessao.get(s.id) ?? null,
    }))
  );

  return [...fichas, ...sessoesCardio];
}

/**
 * Sessões de cardio (achatadas) para o seletor de vínculo do checklist. Devolve
 * as TRÊS modalidades numa lista só, com `modalidade` em cada linha — quem
 * monta o seletor filtra pelo tipo de item escolhido (corrida/natação/ciclismo).
 */
/** Sessões da semana ATIVA do ciclo — é a que o auto-check do checklist segue. */
export async function sessoesCorridaParaPlano(userId: string): Promise<SessaoCorridaOpcao[]> {
  const semana = await semanaCicloAtual(userId);
  return sessoesCorridaParaPlanoDaSemana(userId, semana);
}

async function sessoesCorridaParaPlanoDaSemana(
  userId: string,
  semana: number
): Promise<SessaoCorridaOpcao[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "treinos"));
  cacheLife("usuario");
  const planos = await db.runRoutine.findMany({
    where: { userId },
    orderBy: { ordem: "asc" },
    include: { sessions: { where: { semana }, orderBy: { ordem: "asc" } } },
  });
  return planos.flatMap((p) =>
    p.sessions.map((s) => ({
      id: s.id,
      nome: s.nome,
      tipo: s.tipo,
      planoNome: p.nome,
      modalidade: modalidadeDe(p.modalidade),
    }))
  );
}

export type MediaPeriodo = {
  label: string;
  km: number;
  corridas: number;
  /** Ritmo médio bruto do período — segundos/km (corrida), segundos/100m
   *  (natação) ou km/h (ciclismo). Formate com formatRitmoBruto. */
  paceMedioSeg: number;
  atual: boolean;
};

/** Ritmo médio bruto de um conjunto de sessões, conforme a modalidade. */
function ritmoMedio(km: number, segundos: number, modalidade: ModalidadeCardio): number {
  if (km <= 0 || segundos <= 0) return 0;
  if (modalidade === "ciclismo") return km / (segundos / 3600);
  return segundos / (modalidade === "natacao" ? km * 10 : km);
}

/** Média de distância/sessões/ritmo nos últimos N meses, numa modalidade. */
export async function mediaMensal(
  userId: string,
  meses = 6,
  ref: Date = new Date(),
  modalidade: ModalidadeCardio = "corrida"
): Promise<MediaPeriodo[]> {
  return mediaMensalDoDia(userId, meses, dayKeySP(ref), modalidade);
}

async function mediaMensalDoDia(
  userId: string,
  meses: number,
  dia: string,
  modalidade: ModalidadeCardio
): Promise<MediaPeriodo[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "treinos"));
  cacheLife("usuario");

  const ref = refDoDiaSP(dia);
  const de = spStartOfMonth(subMonths(toSP(ref), meses - 1));
  const corridas = await db.run.findMany({
    where: { userId, modalidade, data: { gte: de, lte: spEndOfDay(ref) } },
  });

  const inicioMesAtual = spStartOfMonth(ref);
  return eachMonthOfInterval({ start: de, end: toSP(ref) }).map((mes) => {
    const inicio = spStartOfMonth(mes);
    const fim = spEndOfMonth(mes);
    const doMes = corridas.filter((c) => c.data >= inicio && c.data <= fim);
    const km = doMes.reduce((s, c) => s + c.km, 0);
    const segundos = doMes.reduce((s, c) => s + c.segundos, 0);
    return {
      label: monthName(mes).slice(0, 3),
      km,
      corridas: doMes.length,
      paceMedioSeg: ritmoMedio(km, segundos, modalidade),
      atual: inicio.getTime() === inicioMesAtual.getTime(),
    };
  });
}

/** Média de distância/sessões/ritmo nos últimos N anos, numa modalidade. */
export async function mediaAnual(
  userId: string,
  anos = 3,
  ref: Date = new Date(),
  modalidade: ModalidadeCardio = "corrida"
): Promise<MediaPeriodo[]> {
  return mediaAnualDoDia(userId, anos, dayKeySP(ref), modalidade);
}

async function mediaAnualDoDia(
  userId: string,
  anos: number,
  dia: string,
  modalidade: ModalidadeCardio
): Promise<MediaPeriodo[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "treinos"));
  cacheLife("usuario");

  const ref = refDoDiaSP(dia);
  const anoAtual = toSP(ref).getFullYear();
  const de = spStartOfDay(new Date(anoAtual - (anos - 1), 0, 1));
  const corridas = await db.run.findMany({
    where: { userId, modalidade, data: { gte: de, lte: spEndOfDay(ref) } },
  });

  const out: MediaPeriodo[] = [];
  for (let i = anos - 1; i >= 0; i--) {
    const ano = anoAtual - i;
    const doAno = corridas.filter((c) => toSP(c.data).getFullYear() === ano);
    const km = doAno.reduce((s, c) => s + c.km, 0);
    const segundos = doAno.reduce((s, c) => s + c.segundos, 0);
    out.push({
      label: String(ano),
      km,
      corridas: doAno.length,
      paceMedioSeg: ritmoMedio(km, segundos, modalidade),
      atual: ano === anoAtual,
    });
  }
  return out;
}

export type MetaDistanciaMes = {
  /** Meta do mês na unidade EXIBIDA da modalidade (km, ou metros na natação). */
  meta: number;
  /** Distância já feita no mês, na mesma unidade. */
  feito: number;
  pct: number;
};

/**
 * Meta mensal de distância da modalidade (Setting) cruzada com o já realizado.
 * Cada modalidade tem sua própria chave e seu próprio padrão (ver MODALIDADE) —
 * uma meta de 40 km de corrida não faz sentido para 12.000 m de natação.
 */
export async function metaDistanciaMes(
  userId: string,
  modalidade: ModalidadeCardio,
  ref: Date = new Date()
): Promise<MetaDistanciaMes> {
  return metaDistanciaMesDoDia(userId, modalidade, dayKeySP(ref));
}

async function metaDistanciaMesDoDia(
  userId: string,
  modalidade: ModalidadeCardio,
  dia: string
): Promise<MetaDistanciaMes> {
  "use cache";
  cacheTag(tagUsuario(userId, "treinos"), tagUsuario(userId, "settings"));
  cacheLife("usuario");

  const cfg = MODALIDADE[modalidade];
  const data = refDoDiaSP(dia);
  const [setting, agg] = await Promise.all([
    db.setting.findUnique({ where: { userId_key: { userId, key: cfg.metaKey } } }),
    db.run.aggregate({
      where: {
        userId,
        modalidade,
        data: { gte: spStartOfMonth(data), lte: spEndOfMonth(data) },
      },
      _sum: { km: true },
    }),
  ]);

  const meta = Number(setting?.value ?? cfg.metaPadrao) || cfg.metaPadrao;
  const feito = (agg._sum.km ?? 0) * cfg.fator;
  return { meta, feito, pct: meta > 0 ? (feito / meta) * 100 : 0 };
}

export type PerfilCorrida = {
  paceBaseSeg: number | null;
  kmSemanaBase: number | null;
};

/** Baseline de corrida configurado em Configurações (Setting key/value). */
export async function perfilCorrida(userId: string): Promise<PerfilCorrida> {
  "use cache";
  // só lê Setting → tag "settings"
  cacheTag(tagUsuario(userId, "settings"));
  cacheLife("usuario");

  const settings = await db.setting.findMany({
    where: {
      userId,
      key: { in: ["corrida_pace_base_seg", "corrida_km_semana_base"] },
    },
  });
  const mapa = new Map(settings.map((s) => [s.key, s.value]));
  const pace = mapa.get("corrida_pace_base_seg");
  const kmSemana = mapa.get("corrida_km_semana_base");
  return {
    paceBaseSeg: pace ? Number(pace) || null : null,
    kmSemanaBase: kmSemana ? Number(kmSemana) || null : null,
  };
}
