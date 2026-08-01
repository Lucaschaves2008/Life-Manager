import {
  cacheLife,
  cacheTag,
} from "next/cache";
import { addDays } from "date-fns";
import { db } from "@/lib/db";
import { tagUsuario } from "@/lib/cache-tags";
import { dayKeySP, refDoDiaSP, spEndOfDay, spStartOfDay, toSP } from "@/lib/dates";

// Padrão de cache deste arquivo (ver lib/data/home.ts): a função exportada
// mantém a assinatura original e delega para uma interna "use cache" com
// chaves ESTÁVEIS (userId/dayKey/id) que só busca no banco. Tudo que depende
// do instante atual — "segundos até agora" de sessão/pausa aberta — roda no
// wrapper, fora do cache; as actions do cronômetro revalidam a tag "estudos".

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
  categoryId: string | null;
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
  categoryId: string | null;
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
    categoryId: s.categoryId,
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
export async function sessaoEmAndamento(userId: string): Promise<SessaoView | null> {
  // o fetch é cacheado (toda action do cronômetro revalida a tag); o cálculo
  // de "segundos até agora" roda aqui, sobre o instante real do request
  const s = await sessaoAtivaDb(userId);
  if (!s) return null;
  return toSessaoView(s, new Date());
}

async function sessaoAtivaDb(userId: string): Promise<SessaoDb | null> {
  "use cache";
  cacheTag(tagUsuario(userId, "estudos"));
  cacheLife("usuario");
  const s = await db.studySession.findFirst({
    where: { userId, endedAt: null },
    orderBy: { startedAt: "desc" },
    include: includePausas,
  });
  return s as SessaoDb | null;
}

/** Sessões iniciadas no dia informado (mais recentes primeiro). */
export async function sessoesDoDia(userId: string, dia: Date): Promise<SessaoView[]> {
  const agora = new Date();
  const sessoes = await sessoesDoDiaDb(userId, dayKeySP(dia));
  return sessoes.map((s) => toSessaoView(s, agora));
}

async function sessoesDoDiaDb(userId: string, dia: string): Promise<SessaoDb[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "estudos"));
  cacheLife("usuario");
  const ref = refDoDiaSP(dia);
  const sessoes = await db.studySession.findMany({
    where: {
      userId,
      startedAt: { gte: spStartOfDay(ref), lte: spEndOfDay(ref) },
    },
    orderBy: { startedAt: "desc" },
    include: includePausas,
  });
  return sessoes as SessaoDb[];
}

/** Uma sessão pelo id, com pausas. */
export async function sessaoPorId(userId: string, id: string): Promise<SessaoView | null> {
  const s = await sessaoPorIdDb(userId, id);
  if (!s) return null;
  return toSessaoView(s, new Date());
}

async function sessaoPorIdDb(userId: string, id: string): Promise<SessaoDb | null> {
  "use cache";
  cacheTag(tagUsuario(userId, "estudos"));
  cacheLife("usuario");
  const s = await db.studySession.findFirst({
    where: { id, userId },
    include: includePausas,
  });
  return s as SessaoDb | null;
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

export async function dashboardEstudos(
  userId: string,
  hoje: Date
): Promise<DashboardEstudos> {
  // o fetch (parte cara) é cacheado por dia; a agregação roda fora do cache
  // porque sessão em andamento conta segundos "até agora" (snapshotSessao)
  const agora = new Date();
  const sessoes = await sessoesDashboardDb(userId, dayKeySP(hoje));

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

async function sessoesDashboardDb(userId: string, dia: string): Promise<SessaoDb[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "estudos"));
  cacheLife("usuario");
  const desde = spStartOfDay(addDays(refDoDiaSP(dia), -55)); // ~8 semanas de histórico
  // pausas só influenciam o snapshot de sessões em andamento; nas finalizadas
  // os totais vêm de totalSeconds/netSeconds — evita carregar ~8 semanas de pausas
  const [finalizadas, abertas] = await Promise.all([
    db.studySession.findMany({
      where: { userId, startedAt: { gte: desde }, endedAt: { not: null } },
      orderBy: { startedAt: "asc" },
    }),
    db.studySession.findMany({
      where: { userId, startedAt: { gte: desde }, endedAt: null },
      include: includePausas,
    }),
  ]);
  return [
    ...finalizadas.map((s) => ({ ...s, pauses: [] })),
    ...(abertas as SessaoDb[]),
  ];
}

// ---------- Categorias de estudo (variáveis reutilizáveis) ----------

export type CategoriaView = {
  id: string;
  nome: string;
  emoji: string;
  cor: string;
  ordem: number;
};

/** Categorias de estudo ativas do usuário, ordenadas. */
export async function categoriasEstudo(userId: string): Promise<CategoriaView[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "estudos"));
  cacheLife("usuario");
  const cats = await db.studyCategory.findMany({
    where: { userId, ativo: true },
    orderBy: { ordem: "asc" },
  });
  return cats.map((c) => ({
    id: c.id,
    nome: c.nome,
    emoji: c.emoji,
    cor: c.cor,
    ordem: c.ordem,
  }));
}

// ---------- Formatação ----------

// Movidos para estudos-format.ts (client-safe); re-export mantém os call
// sites de servidor. Client components importam de "@/lib/data/estudos-format".
export { formatHoras, formatHorasDecimal } from "./estudos-format";
