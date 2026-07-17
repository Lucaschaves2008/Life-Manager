import { differenceInCalendarDays, eachDayOfInterval, subDays, subWeeks } from "date-fns";
import { db } from "@/lib/db";
import {
  dayKeySP,
  shortDate,
  spEndOfDay,
  spEndOfMonth,
  spEndOfWeek,
  spStartOfDay,
  spStartOfMonth,
  spStartOfWeek,
  toSP,
} from "@/lib/dates";

/** Formata segundos como pace "5'32\"/km". */
export function formatPace(segundosPorKm: number): string {
  if (!isFinite(segundosPorKm) || segundosPorKm <= 0) return "—";
  const min = Math.floor(segundosPorKm / 60);
  const seg = Math.round(segundosPorKm % 60);
  return `${min}'${String(seg).padStart(2, "0")}"/km`;
}

/** Formata segundos como h:mm:ss (ou mm:ss). */
export function formatDuracao(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/** Tonelagem em toneladas com 1 casa: "8,2 t". */
export function formatTonelagem(kg: number): string {
  return `${(kg / 1000).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} t`;
}

export type FrequenciaCell = { key: string; value: number; label: string };

/** Frequência dos últimos N dias: sessões + corridas por dia. */
export async function frequencia(
  dias = 119,
  ref: Date = new Date()
): Promise<FrequenciaCell[]> {
  const de = spStartOfDay(subDays(toSP(ref), dias));
  const [sessoes, corridas] = await Promise.all([
    db.workoutSession.findMany({
      where: { data: { gte: de, lte: spEndOfDay(ref) } },
      select: { data: true },
    }),
    db.run.findMany({
      where: { data: { gte: de, lte: spEndOfDay(ref) } },
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

export async function resumoTreinos(ref: Date = new Date()): Promise<ResumoTreinos> {
  const iniMes = spStartOfMonth(ref);
  const fimMes = spEndOfMonth(ref);
  const iniSemana = spStartOfWeek(ref);
  const fimSemana = spEndOfWeek(ref);

  const [sessoesMes, corridasMes, sessoesSemana, corridasSemana, metaSetting, setLogsMes] =
    await Promise.all([
      db.workoutSession.count({ where: { data: { gte: iniMes, lte: fimMes } } }),
      db.run.count({ where: { data: { gte: iniMes, lte: fimMes } } }),
      db.workoutSession.findMany({
        where: { data: { gte: iniSemana, lte: fimSemana } },
        include: { setLogs: true },
      }),
      db.run.findMany({ where: { data: { gte: iniSemana, lte: fimSemana } } }),
      db.setting.findUnique({ where: { key: "meta_treinos_mes" } }),
      db.setLog.findMany({
        where: { session: { data: { gte: iniMes, lte: fimMes } } },
        include: { exercise: true },
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
    streak: await streakDeTreino(ref),
    tonelagemSemana,
    kmSemana,
    porGrupo: Array.from(grupos.entries())
      .map(([grupo, series]) => ({ grupo, series }))
      .sort((a, b) => b.series - a.series),
  };
}

/** Dias consecutivos (contando de hoje/ontem para trás) com sessão ou corrida. */
async function streakDeTreino(ref: Date): Promise<number> {
  const de = subDays(toSP(ref), 120);
  const [sessoes, corridas] = await Promise.all([
    db.workoutSession.findMany({ where: { data: { gte: de } }, select: { data: true } }),
    db.run.findMany({ where: { data: { gte: de } }, select: { data: true } }),
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
  semanas = 8,
  ref: Date = new Date()
): Promise<VolumeSemana[]> {
  const de = spStartOfWeek(subWeeks(toSP(ref), semanas - 1));
  const corridas = await db.run.findMany({
    where: { data: { gte: de, lte: spEndOfDay(ref) } },
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
export async function recordes(): Promise<{ cinco: Recorde; dez: Recorde }> {
  const corridas = await db.run.findMany();

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
  exerciseId: string
): Promise<ProgressaoPonto[]> {
  const logs = await db.setLog.findMany({
    where: { exerciseId },
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
export async function diasDesdeUltimoTreino(ref: Date = new Date()): Promise<number | null> {
  const ultima = await db.workoutSession.findFirst({ orderBy: { data: "desc" } });
  if (!ultima) return null;
  return differenceInCalendarDays(toSP(ref), toSP(ultima.data));
}
