import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import {
  spEndOfMonth,
  spEndOfQuarter,
  spEndOfWeek,
  spStartOfMonth,
  spStartOfQuarter,
  spStartOfWeek,
} from "@/lib/dates";
import type { LinhaDetalhe } from "@/components/caverna/stat-card-detalhe";
import { HOME_CARD_SLOTS } from "@/lib/home-card-slots";

export { HOME_CARD_SLOTS };

/**
 * Catálogo de métricas configuráveis para os 4 cards principais da Home.
 * Cada slot (home_card_1..4) guarda `{ metrica, periodo }` em Setting;
 * esta função resolve esse par para o conteúdo pronto do card.
 */

export type HomePeriodo = "semana" | "mes" | "trimestre";

export const HOME_PERIODOS: { value: HomePeriodo; label: string; contexto: string }[] = [
  { value: "semana", label: "Semana", contexto: "nesta semana" },
  { value: "mes", label: "Mês", contexto: "neste mês" },
  { value: "trimestre", label: "Trimestre", contexto: "neste trimestre" },
];

export type HomeMetricKey =
  | "patrimonio"
  | "investimentos"
  | "receitas"
  | "despesas"
  | "treinos"
  | "corridas_km"
  | "estudos_horas"
  | `meta:${string}`;

export type HomeCardConfig = { metrica: HomeMetricKey; periodo: HomePeriodo };

export const HOME_METRICAS_FIXAS: { value: HomeMetricKey; label: string; acento: string }[] = [
  { value: "patrimonio", label: "Patrimônio total", acento: "var(--color-mint)" },
  { value: "investimentos", label: "Investimentos", acento: "var(--cal-amber)" },
  { value: "receitas", label: "Receitas", acento: "var(--color-mint)" },
  { value: "despesas", label: "Despesas", acento: "var(--color-coral)" },
  { value: "treinos", label: "Treinos", acento: "var(--color-mint)" },
  { value: "corridas_km", label: "Corridas", acento: "var(--cal-teal)" },
  { value: "estudos_horas", label: "Estudos", acento: "var(--cal-lilac)" },
];

export const HOME_CARD_DEFAULTS: HomeCardConfig[] = [
  { metrica: "patrimonio", periodo: "mes" },
  { metrica: "investimentos", periodo: "mes" },
  { metrica: "receitas", periodo: "mes" },
  { metrica: "despesas", periodo: "mes" },
];

export type HomeCardData = {
  label: string;
  value: string;
  pct?: number | null;
  upIsBad?: boolean;
  contexto: string;
  acento: string;
  descricao: string;
  grupos: { titulo?: string; linhas: LinhaDetalhe[] }[];
  total?: { label: string; valor: string };
  verMais?: { href: string; label: string };
};

function rangeDoPeriodo(periodo: HomePeriodo, hoje: Date): { inicio: Date; fim: Date } {
  if (periodo === "semana") return { inicio: spStartOfWeek(hoje), fim: spEndOfWeek(hoje) };
  if (periodo === "trimestre") return { inicio: spStartOfQuarter(hoje), fim: spEndOfQuarter(hoje) };
  return { inicio: spStartOfMonth(hoje), fim: spEndOfMonth(hoje) };
}

const pctOf = (v: number, total: number) => (total > 0 ? v / total : 0);

/** Lê a config salva dos 4 slots (fallback = defaults atuais se nunca configurado). */
export async function homeCardConfigs(userId: string): Promise<HomeCardConfig[]> {
  const settings = await db.setting.findMany({
    where: { userId, key: { in: [...HOME_CARD_SLOTS] } },
  });
  const porChave = new Map(settings.map((s) => [s.key, s.value]));

  return HOME_CARD_SLOTS.map((slot, i) => {
    const raw = porChave.get(slot);
    if (!raw) return HOME_CARD_DEFAULTS[i];
    try {
      const parsed = JSON.parse(raw) as HomeCardConfig;
      if (parsed.metrica && parsed.periodo) return parsed;
    } catch {
      // valor corrompido/antigo → cai no default
    }
    return HOME_CARD_DEFAULTS[i];
  });
}

/** Metas quantitativas do usuário, para popular o catálogo com entradas "meta:<id>". */
export async function metasParaCatalogo(userId: string) {
  const metas = await db.metaQuantitativa.findMany({
    where: { userId },
    orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
    select: { id: true, titulo: true },
  });
  return metas.map((m) => ({ value: `meta:${m.id}` as HomeMetricKey, label: m.titulo }));
}

export async function calcularHomeCard(
  userId: string,
  config: HomeCardConfig,
  hoje: Date
): Promise<HomeCardData> {
  const { periodo } = config;
  const { inicio, fim } = rangeDoPeriodo(periodo, hoje);
  const contexto = HOME_PERIODOS.find((p) => p.value === periodo)!.contexto;

  if (config.metrica === "patrimonio") return patrimonioCard(userId, hoje);
  if (config.metrica === "investimentos") return investimentosCard(userId, hoje);
  if (config.metrica === "receitas") return receitasCard(userId, inicio, fim, contexto);
  if (config.metrica === "despesas") return despesasCard(userId, inicio, fim, contexto);
  if (config.metrica === "treinos") return treinosCard(userId, inicio, fim, contexto);
  if (config.metrica === "corridas_km") return corridasCard(userId, inicio, fim, contexto);
  if (config.metrica === "estudos_horas") return estudosCard(userId, inicio, fim, contexto);
  if (config.metrica.startsWith("meta:")) {
    return metaCard(userId, config.metrica.slice("meta:".length));
  }
  return despesasCard(userId, inicio, fim, contexto);
}

// ---------- Financeiro (patrimônio/investimentos ignoram período — são "hoje") ----------

async function patrimonioCard(userId: string, hoje: Date): Promise<HomeCardData> {
  const { resumoCarteira } = await import("@/lib/data/investimentos");
  const { contasComSaldo } = await import("@/lib/data/financas");
  const [carteira, contas] = await Promise.all([resumoCarteira(userId, hoje), contasComSaldo(userId)]);
  const saldoContas = contas.reduce((s, c) => s + c.saldo, 0);
  const total = carteira.patrimonio + saldoContas;

  const composicao = [
    {
      label: "Investimentos",
      valor: formatBRL(carteira.patrimonio),
      cor: "var(--color-mint)",
      share: pctOf(carteira.patrimonio, total),
      hint: `${Math.round(pctOf(carteira.patrimonio, total) * 100)}%`,
    },
    {
      label: "Saldo em contas",
      valor: formatBRL(saldoContas),
      cor: "var(--cal-teal)",
      share: pctOf(saldoContas, total),
      hint: `${Math.round(pctOf(saldoContas, total) * 100)}%`,
    },
  ];
  const linhasContas = contas
    .filter((c) => c.saldo !== 0)
    .map((c) => ({ label: c.nome, valor: formatBRL(c.saldo), cor: c.cor, share: pctOf(c.saldo, saldoContas) }));

  return {
    label: "Patrimônio total",
    value: formatBRL(total),
    pct: carteira.pctRendimentoMes,
    contexto: "vs mês anterior",
    acento: "var(--color-mint)",
    descricao: "Investimentos somados ao saldo das suas contas, agora.",
    grupos: [
      { titulo: "Composição", linhas: composicao },
      ...(linhasContas.length > 0 ? [{ titulo: "Contas", linhas: linhasContas }] : []),
    ],
    total: { label: "Patrimônio total", valor: formatBRL(total) },
  };
}

async function investimentosCard(userId: string, hoje: Date): Promise<HomeCardData> {
  const { resumoCarteira, ativosResumidos } = await import("@/lib/data/investimentos");
  const [carteira, ativos] = await Promise.all([resumoCarteira(userId, hoje), ativosResumidos(userId, hoje)]);

  const perf = [
    { label: "Total aportado", valor: formatBRL(carteira.aportado), cor: "var(--color-steel)" },
    {
      label: "Rendimento",
      valor: formatBRL(carteira.rendimento),
      cor: carteira.rendimento >= 0 ? "var(--color-mint)" : "var(--color-coral)",
      hint:
        carteira.pctRendimento != null
          ? `${carteira.pctRendimento >= 0 ? "+" : ""}${carteira.pctRendimento.toFixed(1)}%`
          : undefined,
    },
    { label: "Dividendos", valor: formatBRL(carteira.dividendos), cor: "var(--cal-amber)" },
  ];
  const topAtivos = ativos.slice(0, 5).map((a) => ({
    label: a.nome,
    valor: formatBRL(a.valorAtual),
    cor: a.cor,
    share: pctOf(a.valorAtual, carteira.patrimonio),
    hint: `${Math.round(pctOf(a.valorAtual, carteira.patrimonio) * 100)}%`,
  }));

  return {
    label: "Investimentos",
    value: formatBRL(carteira.patrimonio),
    pct: carteira.pctRendimentoMes,
    contexto: "vs mês anterior",
    acento: "var(--cal-amber)",
    descricao: "Aportes, rendimento e seus maiores ativos, agora.",
    grupos: [
      { titulo: "Desempenho", linhas: perf },
      { titulo: "Maiores ativos", linhas: topAtivos },
    ],
    total: { label: "Patrimônio investido", valor: formatBRL(carteira.patrimonio) },
    verMais: { href: "/investimentos", label: "ver investimentos" },
  };
}

// ---------- Finanças por período ----------

/** Cobrança mensal das assinaturas ativas — conta inteira se o período tocar o mês atual. */
async function assinaturasNoPeriodo(userId: string, inicio: Date, fim: Date): Promise<number> {
  const hoje = new Date();
  const tocaMesAtual = inicio <= spEndOfMonth(hoje) && fim >= spStartOfMonth(hoje);
  if (!tocaMesAtual) return 0;
  const agg = await db.subscription.aggregate({
    where: { userId, status: "ativa" },
    _sum: { valor: true },
  });
  return agg._sum.valor ?? 0;
}

async function receitasCard(userId: string, inicio: Date, fim: Date, contexto: string): Promise<HomeCardData> {
  const [agg, assinaturas] = await Promise.all([
    db.transaction.groupBy({
      by: ["tipo"],
      where: { userId, data: { gte: inicio, lte: fim } },
      _sum: { valor: true },
    }),
    assinaturasNoPeriodo(userId, inicio, fim),
  ]);
  const receita = agg.find((a) => a.tipo === "receita")?._sum.valor ?? 0;
  const despesa = (agg.find((a) => a.tipo === "despesa")?._sum.valor ?? 0) + assinaturas;
  const saldo = receita - despesa;
  const max = Math.max(receita, despesa, 1);

  return {
    label: "Receitas",
    value: formatBRL(receita),
    contexto,
    acento: "var(--color-mint)",
    descricao: "Entradas e saídas no período selecionado.",
    grupos: [
      {
        titulo: "Fluxo do período",
        linhas: [
          { label: "Receitas", valor: formatBRL(receita), cor: "var(--color-mint)", share: pctOf(receita, max) },
          { label: "Despesas", valor: formatBRL(despesa), cor: "var(--color-coral)", share: pctOf(despesa, max) },
        ],
      },
    ],
    total: { label: "Saldo do período", valor: formatBRL(saldo) },
    verMais: { href: "/financas", label: "ver finanças" },
  };
}

async function despesasCard(userId: string, inicio: Date, fim: Date, contexto: string): Promise<HomeCardData> {
  const [transacoes, assinaturas] = await Promise.all([
    db.transaction.findMany({
      where: { userId, tipo: "despesa", data: { gte: inicio, lte: fim } },
      include: { category: true },
    }),
    (async () => {
      const hoje = new Date();
      const tocaMesAtual = inicio <= spEndOfMonth(hoje) && fim >= spStartOfMonth(hoje);
      if (!tocaMesAtual) return [];
      return db.subscription.findMany({
        where: { userId, status: "ativa" },
        select: { nome: true, emoji: true, valor: true },
      });
    })(),
  ]);

  const porCategoria = new Map<string, { label: string; cor: string; valor: number }>();
  for (const t of transacoes) {
    const key = t.category?.id ?? "sem-categoria";
    const atual = porCategoria.get(key);
    const label = t.category ? `${t.category.emoji} ${t.category.nome}`.trim() : "Sem categoria";
    const cor = t.category?.cor ?? "var(--color-steel)";
    if (atual) atual.valor += t.valor;
    else porCategoria.set(key, { label, cor, valor: t.valor });
  }
  for (const a of assinaturas) {
    porCategoria.set(`assinatura:${a.nome}`, {
      label: `${a.emoji} ${a.nome} · assinatura`.trim(),
      cor: "var(--cal-lilac)",
      valor: a.valor,
    });
  }

  const totalDespesa = [...porCategoria.values()].reduce((s, c) => s + c.valor, 0);
  const linhas = [...porCategoria.values()]
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 7)
    .map((c) => ({
      label: c.label,
      valor: formatBRL(c.valor),
      cor: c.cor,
      share: pctOf(c.valor, totalDespesa),
      hint: `${Math.round(pctOf(c.valor, totalDespesa) * 100)}%`,
    }));

  return {
    label: "Despesas",
    value: formatBRL(totalDespesa),
    contexto,
    upIsBad: true,
    acento: "var(--color-coral)",
    descricao: "Maiores gastos por categoria no período selecionado, incluindo assinaturas.",
    grupos: [{ titulo: "Categorias e assinaturas", linhas }],
    total: { label: "Total de despesas", valor: formatBRL(totalDespesa) },
    verMais: { href: "/financas", label: "ver finanças" },
  };
}

// ---------- Treinos / Corridas / Estudos ----------

async function treinosCard(userId: string, inicio: Date, fim: Date, contexto: string): Promise<HomeCardData> {
  const [sessoes, corridas] = await Promise.all([
    db.workoutSession.findMany({ where: { userId, data: { gte: inicio, lte: fim } }, select: { duracaoMin: true } }),
    db.run.count({ where: { userId, data: { gte: inicio, lte: fim } } }),
  ]);
  const totalMin = sessoes.reduce((s, w) => s + w.duracaoMin, 0);
  const total = sessoes.length + corridas;
  const max = Math.max(sessoes.length, corridas, 1);

  return {
    label: "Treinos",
    value: `${total}`,
    contexto,
    acento: "var(--color-mint)",
    descricao: "Musculação e corridas registradas no período selecionado.",
    grupos: [
      {
        titulo: "Por tipo",
        linhas: [
          { label: "Musculação", valor: `${sessoes.length}`, cor: "var(--color-mint)", share: pctOf(sessoes.length, max) },
          { label: "Corridas", valor: `${corridas}`, cor: "var(--cal-teal)", share: pctOf(corridas, max) },
        ],
      },
    ],
    total: { label: "Minutos de musculação", valor: `${totalMin} min` },
    verMais: { href: "/treinos", label: "ver treinos" },
  };
}

async function corridasCard(userId: string, inicio: Date, fim: Date, contexto: string): Promise<HomeCardData> {
  const corridas = await db.run.findMany({
    where: { userId, data: { gte: inicio, lte: fim } },
    select: { km: true, segundos: true, tipo: true, data: true },
    orderBy: { data: "desc" },
  });
  const totalKm = corridas.reduce((s, r) => s + r.km, 0);
  const totalSeg = corridas.reduce((s, r) => s + r.segundos, 0);
  const ritmo = totalKm > 0 ? totalSeg / 60 / totalKm : 0;

  const linhas = corridas.slice(0, 7).map((r) => ({
    label: r.data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }),
    valor: `${r.km.toFixed(1)} km`,
    cor: "var(--cal-teal)",
    share: pctOf(r.km, totalKm),
  }));

  return {
    label: "Corridas",
    value: `${totalKm.toFixed(1)} km`,
    contexto,
    acento: "var(--cal-teal)",
    descricao: "Distância percorrida e ritmo médio no período selecionado.",
    grupos: [{ titulo: `${corridas.length} corrida${corridas.length === 1 ? "" : "s"}`, linhas }],
    total: {
      label: "Ritmo médio",
      valor: ritmo > 0 ? `${Math.floor(ritmo)}'${String(Math.round((ritmo % 1) * 60)).padStart(2, "0")}"/km` : "—",
    },
    verMais: { href: "/treinos", label: "ver treinos" },
  };
}

async function estudosCard(userId: string, inicio: Date, fim: Date, contexto: string): Promise<HomeCardData> {
  const sessoes = await db.studySession.findMany({
    where: { userId, startedAt: { gte: inicio, lte: fim }, endedAt: { not: null } },
    select: { netSeconds: true, subject: true },
  });
  const totalSeg = sessoes.reduce((s, x) => s + x.netSeconds, 0);
  const totalHoras = totalSeg / 3600;

  const porAssunto = new Map<string, number>();
  for (const s of sessoes) porAssunto.set(s.subject, (porAssunto.get(s.subject) ?? 0) + s.netSeconds);
  const linhas = [...porAssunto.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([subject, seg]) => ({
      label: subject,
      valor: `${(seg / 3600).toFixed(1)}h`,
      cor: "var(--cal-lilac)",
      share: pctOf(seg, totalSeg),
    }));

  return {
    label: "Estudos",
    value: `${totalHoras.toFixed(1)}h`,
    contexto,
    acento: "var(--cal-lilac)",
    descricao: "Horas estudadas por assunto no período selecionado.",
    grupos: [{ titulo: "Por assunto", linhas }],
    total: { label: "Sessões concluídas", valor: `${sessoes.length}` },
    verMais: { href: "/estudos", label: "ver estudos" },
  };
}

// ---------- Meta quantitativa escolhida pelo usuário ----------

async function metaCard(userId: string, metaId: string): Promise<HomeCardData> {
  const meta = await db.metaQuantitativa.findFirst({ where: { id: metaId, userId } });
  if (!meta) {
    return {
      label: "Meta",
      value: "—",
      contexto: "meta removida",
      acento: "var(--color-steel)",
      descricao: "Esta meta foi removida. Escolha outra métrica para este card.",
      grupos: [],
    };
  }

  const { calcularAtual } = await import("@/lib/data/metas-quantitativas");
  const rangeMap: Record<string, { inicio: Date; fim: Date }> = {
    mes: { inicio: spStartOfMonth(new Date()), fim: spEndOfMonth(new Date()) },
    trimestre: { inicio: spStartOfQuarter(new Date()), fim: spEndOfQuarter(new Date()) },
    ano: { inicio: new Date(new Date().getFullYear(), 0, 1), fim: new Date(new Date().getFullYear(), 11, 31, 23, 59, 59) },
  };
  const { inicio, fim } = rangeMap[meta.periodo] ?? rangeMap.mes;
  const atual = await calcularAtual(userId, meta.metrica as never, inicio, fim);
  const pct = meta.alvo > 0 ? Math.min(100, (atual / meta.alvo) * 100) : 0;

  return {
    label: meta.titulo,
    value: `${Math.round(atual * 10) / 10}`,
    contexto: `de ${meta.alvo} · ${meta.periodo}`,
    acento: pct >= 100 ? "var(--color-mint)" : "var(--cal-amber)",
    descricao: `Progresso automático da meta "${meta.titulo}" no período atual.`,
    grupos: [
      {
        titulo: "Progresso",
        linhas: [
          {
            label: "Cumprido",
            valor: `${Math.round(pct)}%`,
            cor: pct >= 100 ? "var(--color-mint)" : "var(--cal-amber)",
            share: pct / 100,
          },
        ],
      },
    ],
    total: { label: "Alvo", valor: `${meta.alvo}` },
    verMais: { href: "/metas", label: "ver metas" },
  };
}
