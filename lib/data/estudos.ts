import { addDays } from "date-fns";
import { db } from "@/lib/db";
import { dayKeySP, spEndOfDay, spStartOfDay, toSP } from "@/lib/dates";

// ---------- Tipos de visão (serializáveis p/ o cliente) ----------

export type PausaView = {
  id: string;
  startedAt: string; // ISO
  endedAt: string | null;
  durationSec: number;
  label: string | null;
  aberta: boolean;
};

export type SessaoView = {
  id: string;
  subject: string;
  startedAt: string; // ISO
  endedAt: string | null;
  emAndamento: boolean;
  pausadaAgora: boolean;
  brutoSec: number;
  liquidoSec: number;
  pausadoSec: number;
  rating: number;
  notes: string | null;
  targetMinutes: number | null;
  pausas: PausaView[];
};

type SessaoDb = {
  id: string;
  subject: string;
  startedAt: Date;
  endedAt: Date | null;
  totalSeconds: number;
  netSeconds: number;
  targetMinutes: number | null;
  rating: number;
  notes: string | null;
  pauses: {
    id: string;
    startedAt: Date;
    endedAt: Date | null;
    durationSec: number;
    label: string | null;
  }[];
};

function diffSec(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 1000));
}

/** Segundos de uma pausa: se aberta, conta até `agora`. */
function segundosDaPausa(
  p: { startedAt: Date; endedAt: Date | null; durationSec: number },
  agora: Date
): number {
  if (p.endedAt) return p.durationSec || diffSec(p.startedAt, p.endedAt);
  return diffSec(p.startedAt, agora);
}

/**
 * Snapshot de tempos de uma sessão em `agora`.
 * Em andamento: derivado de startedAt + pausas (sobrevive a reload).
 * Finalizada: usa os valores gravados.
 */
export function snapshotSessao(s: SessaoDb, agora: Date) {
  const emAndamento = s.endedAt === null;
  if (!emAndamento) {
    return {
      brutoSec: s.totalSeconds,
      liquidoSec: s.netSeconds,
      pausadoSec: Math.max(0, s.totalSeconds - s.netSeconds),
      pausadaAgora: false,
    };
  }
  const brutoSec = diffSec(s.startedAt, agora);
  const pausadoSec = s.pauses.reduce((t, p) => t + segundosDaPausa(p, agora), 0);
  const pausadaAgora = s.pauses.some((p) => p.endedAt === null);
  return {
    brutoSec,
    liquidoSec: Math.max(0, brutoSec - pausadoSec),
    pausadoSec,
    pausadaAgora,
  };
}

export function toSessaoView(s: SessaoDb, agora: Date): SessaoView {
  const snap = snapshotSessao(s, agora);
  return {
    id: s.id,
    subject: s.subject,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt ? s.endedAt.toISOString() : null,
    emAndamento: s.endedAt === null,
    pausadaAgora: snap.pausadaAgora,
    brutoSec: snap.brutoSec,
    liquidoSec: snap.liquidoSec,
    pausadoSec: snap.pausadoSec,
    rating: s.rating,
    notes: s.notes,
    targetMinutes: s.targetMinutes,
    pausas: s.pauses
      .slice()
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
      .map((p) => ({
        id: p.id,
        startedAt: p.startedAt.toISOString(),
        endedAt: p.endedAt ? p.endedAt.toISOString() : null,
        durationSec: segundosDaPausa(p, agora),
        label: p.label,
        aberta: p.endedAt === null,
      })),
  };
}

const includePausas = {
  pauses: { orderBy: { startedAt: "asc" } },
} as const;

/** A sessão em andamento (no máximo uma), se houver. */
export async function sessaoEmAndamento(): Promise<SessaoView | null> {
  const s = await db.studySession.findFirst({
    where: { endedAt: null },
    orderBy: { startedAt: "desc" },
    include: includePausas,
  });
  if (!s) return null;
  return toSessaoView(s as SessaoDb, new Date());
}

/** Sessões iniciadas no dia informado (mais recentes primeiro). */
export async function sessoesDoDia(dia: Date): Promise<SessaoView[]> {
  const agora = new Date();
  const sessoes = await db.studySession.findMany({
    where: {
      startedAt: { gte: spStartOfDay(dia), lte: spEndOfDay(dia) },
    },
    orderBy: { startedAt: "desc" },
    include: includePausas,
  });
  return sessoes.map((s) => toSessaoView(s as SessaoDb, agora));
}

/** Uma sessão pelo id, com pausas. */
export async function sessaoPorId(id: string): Promise<SessaoView | null> {
  const s = await db.studySession.findUnique({
    where: { id },
    include: includePausas,
  });
  if (!s) return null;
  return toSessaoView(s as SessaoDb, new Date());
}

// ---------- Dashboard ----------

export type DiaEstudo = { dia: string; label: string; horas: number };
export type AssuntoEstudo = { subject: string; segundos: number; sessoes: number };

export type DashboardEstudos = {
  horasHoje: number;
  sessoesHoje: number;
  totalSemanaHoras: number;
  mediaDiariaHoras: number; // média das últimas 4 semanas (por dia)
  mediaSemanalHoras: number; // horas por semana, em média
  streak: number;
  porDia: DiaEstudo[]; // últimos 14 dias
  porAssunto: AssuntoEstudo[];
};

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export async function dashboardEstudos(hoje: Date): Promise<DashboardEstudos> {
  const agora = new Date();
  const desde = spStartOfDay(addDays(hoje, -55)); // ~8 semanas de histórico
  const sessoes = (await db.studySession.findMany({
    where: { startedAt: { gte: desde } },
    orderBy: { startedAt: "asc" },
    include: includePausas,
  })) as SessaoDb[];

  // segundos líquidos por chave de dia
  const segPorDia = new Map<string, number>();
  const contagemPorDia = new Map<string, number>();
  const segPorAssunto = new Map<string, number>();
  const sessPorAssunto = new Map<string, number>();

  for (const s of sessoes) {
    const chave = dayKeySP(s.startedAt);
    const snap = snapshotSessao(s, agora);
    segPorDia.set(chave, (segPorDia.get(chave) ?? 0) + snap.liquidoSec);
    contagemPorDia.set(chave, (contagemPorDia.get(chave) ?? 0) + 1);
    segPorAssunto.set(
      s.subject,
      (segPorAssunto.get(s.subject) ?? 0) + snap.liquidoSec
    );
    sessPorAssunto.set(s.subject, (sessPorAssunto.get(s.subject) ?? 0) + 1);
  }

  // últimos 14 dias para o gráfico
  const porDia: DiaEstudo[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(hoje, -i);
    const chave = dayKeySP(d);
    const seg = segPorDia.get(chave) ?? 0;
    porDia.push({
      dia: chave,
      label: DIAS_SEMANA[toSP(d).getDay()],
      horas: seg / 3600,
    });
  }

  const chaveHoje = dayKeySP(hoje);
  const horasHoje = (segPorDia.get(chaveHoje) ?? 0) / 3600;
  const sessoesHoje = contagemPorDia.get(chaveHoje) ?? 0;

  // total desta semana (últimos 7 dias, incluindo hoje)
  let segSemana = 0;
  for (let i = 0; i < 7; i++) {
    segSemana += segPorDia.get(dayKeySP(addDays(hoje, -i))) ?? 0;
  }
  const totalSemanaHoras = segSemana / 3600;

  // média das últimas 4 semanas (28 dias)
  let seg28 = 0;
  for (let i = 0; i < 28; i++) {
    seg28 += segPorDia.get(dayKeySP(addDays(hoje, -i))) ?? 0;
  }
  const mediaDiariaHoras = seg28 / 28 / 3600;
  const mediaSemanalHoras = seg28 / 4 / 3600;

  // streak: dias seguidos (até hoje ou ontem) com ao menos uma sessão
  let streak = 0;
  {
    let i = 0;
    // se hoje ainda não estudou, o streak pode terminar ontem
    if ((segPorDia.get(chaveHoje) ?? 0) === 0) i = 1;
    for (; ; i++) {
      const chave = dayKeySP(addDays(hoje, -i));
      if ((segPorDia.get(chave) ?? 0) > 0) streak++;
      else break;
    }
  }

  const porAssunto: AssuntoEstudo[] = [...segPorAssunto.entries()]
    .map(([subject, segundos]) => ({
      subject,
      segundos,
      sessoes: sessPorAssunto.get(subject) ?? 0,
    }))
    .sort((a, b) => b.segundos - a.segundos);

  return {
    horasHoje,
    sessoesHoje,
    totalSemanaHoras,
    mediaDiariaHoras,
    mediaSemanalHoras,
    streak,
    porDia,
    porAssunto,
  };
}

// ---------- Formatação ----------

/** 3725 → "1h 02min" ; 125 → "2min" ; 0 → "0min" */
export function formatHoras(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.round((segundos % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  return `${m}min`;
}

/** horas decimais → "5,4 h" */
export function formatHorasDecimal(horas: number): string {
  return `${horas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
}
