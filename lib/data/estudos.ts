import {
  cacheLife,
  cacheTag,
} from "next/cache";
import { addDays } from "date-fns";
import { db } from "@/lib/db";
import { tagUsuario } from "@/lib/cache-tags";
import {
  dayKeySP,
  fmtSP,
  refDoDiaSP,
  spEndOfDay,
  spStartOfDay,
  spStartOfWeek,
  toSP,
} from "@/lib/dates";

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

// ---------- Tópicos (categoria = tópico, assunto = subtópico) ----------

/** Bucket das sessões sem categoria — vira um "tópico" navegável como os outros. */
export const TOPICO_SEM_CATEGORIA = "sem-categoria";

/** "hoje" | "ontem" | "há 4 dias" | "há 3 semanas" | "nunca" — em dias de SP. */
export function rotuloDesde(iso: string | null, hoje: Date): string {
  if (!iso) return "nunca";
  const dias = Math.round(
    (spStartOfDay(hoje).getTime() - spStartOfDay(new Date(iso)).getTime()) /
      86_400_000
  );
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  if (dias < 14) return "há 1 semana";
  if (dias < 60) return `há ${Math.floor(dias / 7)} semanas`;
  if (dias < 365) return `há ${Math.floor(dias / 30)} meses`;
  return `há ${Math.floor(dias / 365)} ano(s)`;
}

export type SessaoResumo = {
  id: string;
  subject: string;
  startedAt: string; // ISO
  endedAt: string | null;
  emAndamento: boolean;
  brutoSec: number;
  liquidoSec: number;
  pausadoSec: number;
  rating: number;
  notes: string | null;
};

export type SubtopicoEstudo = {
  subject: string;
  segundos: number;
  sessoes: number;
  mediaSec: number;
  ultimaISO: string;
  notas: number;
};

export type SemanaEstudo = { key: string; label: string; horas: number };
export type BarraEstudo = { label: string; segundos: number };

export type TopicoResumo = {
  id: string; // categoryId | TOPICO_SEM_CATEGORIA
  nome: string;
  emoji: string;
  cor: string;
  ativo: boolean;
  totalSec: number;
  sessoes: number;
  mediaSessaoSec: number;
  mediaSemanalSec: number;
  ultimaISO: string | null;
  notas: number;
  subtopicos: number;
  serie12: number[]; // segundos por semana, 12 semanas (sparkline)
};

export type DetalheTopico = TopicoResumo & {
  primeiraISO: string | null;
  diasAtivos: number;
  streak: number;
  mediaDiaAtivoSec: number;
  melhorSemanaSec: number;
  melhorSemanaLabel: string;
  melhorDiaSec: number;
  melhorDiaLabel: string;
  brutoSec: number;
  pausadoSec: number;
  focoPct: number;
  semanas: SemanaEstudo[];
  porDiaSemana: BarraEstudo[];
  porHora: BarraEstudo[];
  subtopicosLista: SubtopicoEstudo[];
  sessoesLista: SessaoResumo[];
  notasLista: SessaoResumo[];
};

type CategoriaDb = {
  id: string;
  nome: string;
  emoji: string;
  cor: string;
  ordem: number;
  ativo: boolean;
};

const CAMPOS_SESSAO = {
  id: true,
  subject: true,
  startedAt: true,
  endedAt: true,
  totalSeconds: true,
  netSeconds: true,
  targetMinutes: true,
  rating: true,
  notes: true,
  categoryId: true,
} as const;

/**
 * Histórico COMPLETO de sessões + todas as categorias (inclusive as excluídas,
 * que ainda nomeiam sessões antigas). É o insumo das páginas de tópico, que
 * mostram totais de sempre — não de uma janela.
 *
 * As pausas só entram nas sessões em andamento: nas finalizadas os tempos já
 * estão gravados em totalSeconds/netSeconds (o mesmo motivo de
 * sessoesDashboardDb). O parâmetro `dia` só existe como chave de cache.
 */
async function historicoEstudosDb(
  userId: string,
  dia: string
): Promise<{ sessoes: SessaoDb[]; categorias: CategoriaDb[] }> {
  "use cache";
  cacheTag(tagUsuario(userId, "estudos"));
  cacheLife("usuario");
  void dia;
  const [finalizadas, abertas, categorias] = await Promise.all([
    db.studySession.findMany({
      where: { userId, endedAt: { not: null } },
      orderBy: { startedAt: "asc" },
      select: CAMPOS_SESSAO,
    }),
    db.studySession.findMany({
      where: { userId, endedAt: null },
      include: includePausas,
    }),
    db.studyCategory.findMany({
      where: { userId },
      orderBy: { ordem: "asc" },
      select: { id: true, nome: true, emoji: true, cor: true, ordem: true, ativo: true },
    }),
  ]);
  return {
    sessoes: [
      ...finalizadas.map((s) => ({ ...s, pauses: [] })),
      ...(abertas as SessaoDb[]),
    ],
    categorias,
  };
}

/** Chave de agrupamento por tópico: a categoria, ou o bucket "sem categoria". */
function chaveTopico(s: { categoryId: string | null }): string {
  return s.categoryId ?? TOPICO_SEM_CATEGORIA;
}

function identidadeTopico(
  id: string,
  categorias: CategoriaDb[]
): { nome: string; emoji: string; cor: string; ativo: boolean } | null {
  if (id === TOPICO_SEM_CATEGORIA) {
    return {
      nome: "Sem categoria",
      emoji: "📌",
      cor: "var(--color-steel)",
      ativo: true,
    };
  }
  const c = categorias.find((x) => x.id === id);
  if (!c) return null;
  return { nome: c.nome, emoji: c.emoji, cor: c.cor, ativo: c.ativo };
}

/** Números crus de um conjunto de sessões — base do resumo e do detalhe. */
function acumula(sessoes: SessaoDb[], agora: Date) {
  let totalSec = 0;
  let brutoSec = 0;
  let pausadoSec = 0;
  let notas = 0;
  let primeira: Date | null = null;
  let ultima: Date | null = null;
  const porDia = new Map<string, number>();
  const porSemana = new Map<string, number>();
  const porDiaSemana = Array<number>(7).fill(0);
  const porHora = Array<number>(24).fill(0);
  const porSubject = new Map<
    string,
    { segundos: number; sessoes: number; ultima: Date; notas: number }
  >();
  const lista: SessaoResumo[] = [];

  for (const s of sessoes) {
    const snap = snapshotSessao(s, agora);
    const emSP = toSP(s.startedAt);
    totalSec += snap.liquidoSec;
    brutoSec += snap.brutoSec;
    pausadoSec += snap.pausadoSec;
    const temNota = !!s.notes?.trim();
    if (temNota) notas++;
    if (!primeira || s.startedAt < primeira) primeira = s.startedAt;
    if (!ultima || s.startedAt > ultima) ultima = s.startedAt;

    const chaveDia = dayKeySP(s.startedAt);
    porDia.set(chaveDia, (porDia.get(chaveDia) ?? 0) + snap.liquidoSec);
    const chaveSemana = dayKeySP(spStartOfWeek(s.startedAt));
    porSemana.set(chaveSemana, (porSemana.get(chaveSemana) ?? 0) + snap.liquidoSec);
    porDiaSemana[emSP.getDay()] += snap.liquidoSec;
    porHora[emSP.getHours()] += snap.liquidoSec;

    const sub = porSubject.get(s.subject);
    if (sub) {
      sub.segundos += snap.liquidoSec;
      sub.sessoes++;
      if (s.startedAt > sub.ultima) sub.ultima = s.startedAt;
      if (temNota) sub.notas++;
    } else {
      porSubject.set(s.subject, {
        segundos: snap.liquidoSec,
        sessoes: 1,
        ultima: s.startedAt,
        notas: temNota ? 1 : 0,
      });
    }

    lista.push({
      id: s.id,
      subject: s.subject,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt ? s.endedAt.toISOString() : null,
      emAndamento: s.endedAt === null,
      brutoSec: snap.brutoSec,
      liquidoSec: snap.liquidoSec,
      pausadoSec: snap.pausadoSec,
      rating: s.rating,
      notes: s.notes,
    });
  }

  lista.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return {
    totalSec,
    brutoSec,
    pausadoSec,
    notas,
    primeira,
    ultima,
    sessoes: sessoes.length,
    porDia,
    porSemana,
    porDiaSemana,
    porHora,
    porSubject,
    lista,
  };
}

type Acumulado = ReturnType<typeof acumula>;

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Semanas corridas desde a primeira sessão (mínimo 1) — denominador da média
 * semanal. Conta semanas de calendário, não blocos de 7 dias: quem estudou
 * só ontem tem 1 semana, não 0.
 */
function semanasCorridas(primeira: Date | null, hoje: Date): number {
  if (!primeira) return 1;
  const dif =
    spStartOfWeek(hoje).getTime() - spStartOfWeek(primeira).getTime();
  return Math.max(1, Math.round(dif / SEMANA_MS) + 1);
}

/** Dias seguidos (terminando hoje ou ontem) com ao menos uma sessão do tópico. */
function streakDe(porDia: Map<string, number>, hoje: Date): number {
  let streak = 0;
  let i = (porDia.get(dayKeySP(hoje)) ?? 0) > 0 ? 0 : 1;
  for (; i < 3650; i++) {
    if ((porDia.get(dayKeySP(addDays(hoje, -i))) ?? 0) > 0) streak++;
    else break;
  }
  return streak;
}

/** Chaves das últimas 12 semanas (domingo a domingo), da mais antiga p/ a atual. */
function ultimas12Semanas(hoje: Date): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const inicio = spStartOfWeek(addDays(hoje, -7 * i));
    out.push({ key: dayKeySP(inicio), label: fmtSP(inicio, "dd/MM") });
  }
  return out;
}

function resumoDoTopico(
  id: string,
  ident: { nome: string; emoji: string; cor: string; ativo: boolean },
  acc: Acumulado,
  hoje: Date
): TopicoResumo {
  return {
    id,
    nome: ident.nome,
    emoji: ident.emoji,
    cor: ident.cor,
    ativo: ident.ativo,
    totalSec: acc.totalSec,
    sessoes: acc.sessoes,
    mediaSessaoSec: acc.sessoes ? Math.round(acc.totalSec / acc.sessoes) : 0,
    mediaSemanalSec: Math.round(acc.totalSec / semanasCorridas(acc.primeira, hoje)),
    ultimaISO: acc.ultima ? acc.ultima.toISOString() : null,
    notas: acc.notas,
    subtopicos: acc.porSubject.size,
    serie12: ultimas12Semanas(hoje).map((s) => acc.porSemana.get(s.key) ?? 0),
  };
}

/**
 * Todos os tópicos do usuário, do mais estudado ao menos — inclusive
 * categorias ativas ainda sem nenhuma sessão (aparecem zeradas).
 */
export async function topicosEstudo(
  userId: string,
  hoje: Date
): Promise<TopicoResumo[]> {
  const agora = new Date();
  const { sessoes, categorias } = await historicoEstudosDb(userId, dayKeySP(hoje));

  const grupos = new Map<string, SessaoDb[]>();
  for (const s of sessoes) {
    const chave = chaveTopico(s);
    const atual = grupos.get(chave);
    if (atual) atual.push(s);
    else grupos.set(chave, [s]);
  }

  const topicos: TopicoResumo[] = [];
  for (const [id, doGrupo] of grupos) {
    const ident = identidadeTopico(id, categorias);
    if (!ident) continue; // categoria de outro usuário/inexistente: ignora
    topicos.push(resumoDoTopico(id, ident, acumula(doGrupo, agora), hoje));
  }

  // categorias ativas sem sessão: existem no app, então existem na lista
  for (const c of categorias) {
    if (!c.ativo || grupos.has(c.id)) continue;
    topicos.push(
      resumoDoTopico(
        c.id,
        { nome: c.nome, emoji: c.emoji, cor: c.cor, ativo: true },
        acumula([], agora),
        hoje
      )
    );
  }

  return topicos.sort((a, b) => b.totalSec - a.totalSec);
}

/** Tudo sobre um tópico: métricas, distribuições, subtópicos, sessões e notas. */
export async function detalheTopico(
  userId: string,
  topicoId: string,
  hoje: Date
): Promise<DetalheTopico | null> {
  const agora = new Date();
  const { sessoes, categorias } = await historicoEstudosDb(userId, dayKeySP(hoje));
  const ident = identidadeTopico(topicoId, categorias);
  if (!ident) return null;
  // "sem categoria" só é um tópico de verdade se houver sessão sem categoria
  const doTopico = sessoes.filter((s) => chaveTopico(s) === topicoId);
  if (topicoId === TOPICO_SEM_CATEGORIA && doTopico.length === 0) return null;

  const acc = acumula(doTopico, agora);
  const base = resumoDoTopico(topicoId, ident, acc, hoje);

  const semanas = ultimas12Semanas(hoje).map((s) => ({
    key: s.key,
    label: s.label,
    horas: (acc.porSemana.get(s.key) ?? 0) / 3600,
  }));

  // melhor semana e melhor dia consideram TODO o histórico, não só as 12 últimas
  let melhorSemanaSec = 0;
  let melhorSemanaKey: string | null = null;
  for (const [key, sec] of acc.porSemana) {
    if (sec > melhorSemanaSec) {
      melhorSemanaSec = sec;
      melhorSemanaKey = key;
    }
  }
  let melhorDiaSec = 0;
  let melhorDiaKey: string | null = null;
  for (const [key, sec] of acc.porDia) {
    if (sec > melhorDiaSec) {
      melhorDiaSec = sec;
      melhorDiaKey = key;
    }
  }

  const diasAtivos = [...acc.porDia.values()].filter((v) => v > 0).length;

  const subtopicosLista: SubtopicoEstudo[] = [...acc.porSubject.entries()]
    .map(([subject, v]) => ({
      subject,
      segundos: v.segundos,
      sessoes: v.sessoes,
      mediaSec: Math.round(v.segundos / v.sessoes),
      ultimaISO: v.ultima.toISOString(),
      notas: v.notas,
    }))
    .sort((a, b) => b.segundos - a.segundos);

  return {
    ...base,
    primeiraISO: acc.primeira ? acc.primeira.toISOString() : null,
    diasAtivos,
    streak: streakDe(acc.porDia, hoje),
    mediaDiaAtivoSec: diasAtivos ? Math.round(acc.totalSec / diasAtivos) : 0,
    melhorSemanaSec,
    melhorSemanaLabel: melhorSemanaKey
      ? `semana de ${fmtSP(refDoDiaSP(melhorSemanaKey), "dd/MM")}`
      : "—",
    melhorDiaSec,
    melhorDiaLabel: melhorDiaKey
      ? fmtSP(refDoDiaSP(melhorDiaKey), "dd/MM/yyyy")
      : "—",
    brutoSec: acc.brutoSec,
    pausadoSec: acc.pausadoSec,
    focoPct: acc.brutoSec ? Math.round((acc.totalSec / acc.brutoSec) * 100) : 0,
    semanas,
    porDiaSemana: DIAS_SEMANA.map((label, i) => ({
      label,
      segundos: acc.porDiaSemana[i],
    })),
    porHora: acc.porHora.map((segundos, h) => ({
      label: `${String(h).padStart(2, "0")}h`,
      segundos,
    })),
    subtopicosLista,
    sessoesLista: acc.lista,
    notasLista: acc.lista.filter((s) => !!s.notes?.trim()),
  };
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
