import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
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
  kmDaSemana,
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
  weekConfig,
} from "./treinos-format";
export type {
  PlanoCorridaView,
  SessaoCorridaView,
  SessaoCorridaOpcao,
} from "./treinos-format";
// kmDaSemana é usado internamente (import direto acima); client components que
// precisarem dele importam de "@/lib/data/treinos-format".

/** Semana atual do ciclo de periodização (Setting; virada manual). Mín. 1. */
export async function semanaCicloAtual(userId: string): Promise<number> {
  "use cache";
  cacheTag(tagUsuario(userId, "settings"));
  cacheLife("days");

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
  cacheLife("days");

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

export type ResumoTreinos = {
  treinosMes: number;
  metaMes: number;
  pctMeta: number;
  streak: number;
  tonelagemSemana: number;
  kmSemana: number;
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
  cacheLife("days");

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
  const kmSemana = corridasSemana.reduce((s, c) => s + c.km, 0);

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
    kmSemana,
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

/** Km por semana nas últimas N semanas. */
export async function volumeSemanal(
  userId: string,
  semanas = 8,
  ref: Date = new Date()
): Promise<VolumeSemana[]> {
  return volumeSemanalDoDia(userId, semanas, dayKeySP(ref));
}

async function volumeSemanalDoDia(
  userId: string,
  semanas: number,
  dia: string
): Promise<VolumeSemana[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "treinos"));
  cacheLife("days");

  const ref = refDoDiaSP(dia);
  const de = spStartOfWeek(subWeeks(toSP(ref), semanas - 1));
  const corridas = await db.run.findMany({
    where: { userId, data: { gte: de, lte: spEndOfDay(ref) } },
  });

  const out: VolumeSemana[] = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const inicio = spStartOfWeek(subWeeks(toSP(ref), i));
    const fim = spEndOfWeek(subWeeks(toSP(ref), i));
    const km = corridas
      .filter((c) => c.data >= inicio && c.data <= fim)
      .reduce((s, c) => s + c.km, 0);
    out.push({ label: shortDate(inicio).slice(0, 5), km, atual: i === 0 });
  }
  return out;
}

export type Recorde = { distancia: string; tempo: number; data: Date } | null;

/** Melhor tempo projetado em 5k e 10k a partir das corridas registradas. */
export async function recordes(
  userId: string
): Promise<{ cinco: Recorde; dez: Recorde }> {
  "use cache";
  cacheTag(tagUsuario(userId, "treinos"));
  cacheLife("days");

  // só as faixas usadas nos cálculos de 5k e 10k
  const corridas = await db.run.findMany({
    where: {
      userId,
      OR: [{ km: { gte: 5, lte: 6.5 } }, { km: { gte: 10, lte: 12.5 } }],
    },
    select: { km: true, segundos: true, data: true },
  });

  const melhor = (min: number, max: number, alvo: number): Recorde => {
    const candidatas = corridas.filter((c) => c.km >= min && c.km <= max);
    if (candidatas.length === 0) return null;
    const projetadas = candidatas.map((c) => ({
      tempo: Math.round((c.segundos / c.km) * alvo),
      data: c.data,
    }));
    projetadas.sort((a, b) => a.tempo - b.tempo);
    return {
      distancia: `${alvo} km`,
      tempo: projetadas[0].tempo,
      data: projetadas[0].data,
    };
  };

  return { cinco: melhor(5, 6.5, 5), dez: melhor(10, 12.5, 10) };
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
  cacheLife("days");

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
  cacheLife("days");

  const ref = refDoDiaSP(dia);
  const ultima = await db.workoutSession.findFirst({
    where: { userId },
    orderBy: { data: "desc" },
  });
  if (!ultima) return null;
  return differenceInCalendarDays(toSP(ref), toSP(ultima.data));
}

// ---------- Planos de corrida (nomeados, com progressão semanal) ----------
// Espelha a estrutura da musculação: plano → sessões → km efetivo da semana do
// ciclo (kmDaSemana, mesma regra "repete até editar"). Cruza com as corridas da
// semana para marcar o que já foi cumprido.

/** Planos de corrida do usuário, resolvidos para a semana do ciclo atual. */
export async function planosCorrida(
  userId: string,
  ref: Date = new Date()
): Promise<PlanoCorridaView[]> {
  const semana = await semanaCicloAtual(userId);
  return planosCorridaDoDia(userId, semana, dayKeySP(ref));
}

async function planosCorridaDoDia(
  userId: string,
  semana: number,
  dia: string
): Promise<PlanoCorridaView[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "treinos"));
  cacheLife("days");

  const ref = refDoDiaSP(dia);
  const inicio = spStartOfWeek(ref);
  const fim = spEndOfWeek(ref);

  const [planos, runs] = await Promise.all([
    db.runRoutine.findMany({
      where: { userId },
      orderBy: { ordem: "asc" },
      include: {
        sessions: {
          orderBy: { ordem: "asc" },
          include: { weeks: { orderBy: { semana: "asc" } } },
        },
      },
    }),
    db.run.findMany({
      where: { userId, data: { gte: inicio, lte: fim } },
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

  return planos.map((p) => ({
    id: p.id,
    nome: p.nome,
    foco: p.foco,
    diasSemana: parseDias(p.diasSemana),
    sessoes: p.sessions.map((s) => {
      const km = kmDaSemana(s.kmAlvo, s.weeks, semana);
      const run = runPorSessao.get(s.id) ?? null;
      return {
        id: s.id,
        nome: s.nome,
        tipo: s.tipo,
        kmAlvoBase: s.kmAlvo,
        kmAlvoSemana: km.kmAlvo,
        herdado: km.herdado,
        origemSemana: km.origem,
        cumprida: run ? { id: run.id, km: run.km, segundos: run.segundos } : null,
        overrides: s.weeks.map((w) => ({ semana: w.semana, kmAlvo: w.kmAlvo })),
      };
    }),
  }));
}

function parseDias(raw: string): number[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(Number).filter((n) => n >= 0 && n <= 6) : [];
  } catch {
    return [];
  }
}

/** Sessões de corrida (achatadas) para o seletor de vínculo do checklist. */
export async function sessoesCorridaParaPlano(
  userId: string
): Promise<SessaoCorridaOpcao[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "treinos"));
  cacheLife("days");
  const planos = await db.runRoutine.findMany({
    where: { userId },
    orderBy: { ordem: "asc" },
    include: { sessions: { orderBy: { ordem: "asc" } } },
  });
  return planos.flatMap((p) =>
    p.sessions.map((s) => ({
      id: s.id,
      nome: s.nome,
      tipo: s.tipo,
      planoNome: p.nome,
    }))
  );
}

export type MediaPeriodo = {
  label: string;
  km: number;
  corridas: number;
  paceMedioSeg: number;
  atual: boolean;
};

/** Média de km/corridas/pace nos últimos N meses. */
export async function mediaMensal(
  userId: string,
  meses = 6,
  ref: Date = new Date()
): Promise<MediaPeriodo[]> {
  return mediaMensalDoDia(userId, meses, dayKeySP(ref));
}

async function mediaMensalDoDia(
  userId: string,
  meses: number,
  dia: string
): Promise<MediaPeriodo[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "treinos"));
  cacheLife("days");

  const ref = refDoDiaSP(dia);
  const de = spStartOfMonth(subMonths(toSP(ref), meses - 1));
  const corridas = await db.run.findMany({
    where: { userId, data: { gte: de, lte: spEndOfDay(ref) } },
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
      paceMedioSeg: km > 0 ? segundos / km : 0,
      atual: inicio.getTime() === inicioMesAtual.getTime(),
    };
  });
}

/** Média de km/corridas/pace nos últimos N anos. */
export async function mediaAnual(
  userId: string,
  anos = 3,
  ref: Date = new Date()
): Promise<MediaPeriodo[]> {
  return mediaAnualDoDia(userId, anos, dayKeySP(ref));
}

async function mediaAnualDoDia(
  userId: string,
  anos: number,
  dia: string
): Promise<MediaPeriodo[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "treinos"));
  cacheLife("days");

  const ref = refDoDiaSP(dia);
  const anoAtual = toSP(ref).getFullYear();
  const de = spStartOfDay(new Date(anoAtual - (anos - 1), 0, 1));
  const corridas = await db.run.findMany({
    where: { userId, data: { gte: de, lte: spEndOfDay(ref) } },
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
      paceMedioSeg: km > 0 ? segundos / km : 0,
      atual: ano === anoAtual,
    });
  }
  return out;
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
  cacheLife("days");

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
