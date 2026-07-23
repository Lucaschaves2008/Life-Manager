import Link from "next/link";
import { subDays, subMonths } from "date-fns";
import { ArrowUpRight, CalendarClock, Layers, Wallet } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { BarList } from "@/components/caverna/bar-list";
import { EmptyState } from "@/components/caverna/empty-state";
import { EntityListFooter, EntityRow } from "@/components/caverna/entity-list";
import { Heatmap } from "@/components/caverna/heatmap";
import { HeroInsight } from "@/components/caverna/hero-insight";
import { HeroMoney } from "@/components/caverna/hero-money";
import { PillTabs } from "@/components/caverna/pill-tabs";
import { VariationBadge } from "@/components/caverna/variation-badge";
import { RitmoChart } from "@/components/charts/ritmo-chart";
import { AssinaturasClient } from "@/components/financas/assinaturas-client";
import { CartoesClient } from "@/components/financas/cartoes-client";
import { CategoriasClient } from "@/components/financas/categorias-client";
import { FluxoChart } from "@/components/financas/fluxo-chart";
import { ParcelamentosClient } from "@/components/financas/parcelamentos-client";
import {
  TransacoesClient,
  type LinhaTransacao,
} from "@/components/financas/transacoes-client";
import {
  categoriasComparadas,
  contasComSaldo,
  faturasDosCartoes,
  fluxoDeCaixa,
  gastosPorDiaDoMes,
  parcelamentos,
  proximosVencimentos,
  resumoDoMes,
  ritmoDeGastos,
} from "@/lib/data/financas";
import { ativosResumidos } from "@/lib/data/investimentos";
import { insightFinanceiroPrincipal } from "@/lib/data/insights-server";
import {
  dayKeySP,
  monthName,
  nowSP,
  shortDate,
  spEndOfMonth,
  spStartOfMonth,
  toSP,
} from "@/lib/dates";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { parseJSON } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const tabs = [
  { label: "Visão geral", href: "/financas", value: "visao" },
  { label: "Transações", href: "/financas?tab=transacoes", value: "transacoes" },
  {
    label: "Parcelamentos",
    href: "/financas?tab=parcelamentos",
    value: "parcelamentos",
  },
  { label: "Assinaturas", href: "/financas?tab=assinaturas", value: "assinaturas" },
  { label: "Categorias", href: "/financas?tab=categorias", value: "categorias" },
  { label: "Cartões", href: "/financas?tab=cartoes", value: "cartoes" },
];

type Busca = {
  tab?: string;
  periodo?: string;
  conta?: string;
  categoria?: string;
  q?: string;
  novo?: string;
};

const rotuloConta: Record<string, string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  carteira: "Carteira",
};

function intervaloDoPeriodo(periodo: string | undefined, hoje: Date) {
  switch (periodo) {
    case "mes-passado": {
      const ref = subMonths(toSP(hoje), 1);
      return { gte: spStartOfMonth(ref), lte: spEndOfMonth(ref) };
    }
    case "90d":
      return { gte: subDays(toSP(hoje), 90), lte: spEndOfMonth(hoje) };
    case "tudo":
      return undefined;
    default:
      return { gte: spStartOfMonth(hoje), lte: spEndOfMonth(hoje) };
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const user = await getCurrentUser();
  const busca = await searchParams;
  const tab = busca.novo === "1" ? "transacoes" : busca.tab ?? "visao";
  const hoje = nowSP();

  const [categorias, contasSaldo, faturas, ativosResumo] = await Promise.all([
    db.category.findMany({ where: { userId: user.id }, orderBy: { nome: "asc" } }),
    contasComSaldo(user.id),
    faturasDosCartoes(user.id, hoje),
    ativosResumidos(user.id, hoje),
  ]);

  const opcoesContas = contasSaldo.map((c) => ({
    id: c.id,
    nome: c.nome,
    saldo: c.saldo,
    saldoLabel: "Saldo",
  }));
  const opcoesCategorias = categorias.map((c) => ({
    id: c.id,
    nome: c.nome,
    emoji: c.emoji,
    tipo: c.tipo,
  }));
  const opcoesCartoes = faturas.map((f) => ({
    id: f.id,
    nome: f.nome,
    saldo: f.utilizado,
    saldoLabel: f.tipo === "credito" ? "Fatura em aberto" : "Utilizado",
  }));
  const opcoesAtivos = ativosResumo.map((a) => ({
    id: a.id,
    nome: a.nome,
    saldo: a.valorAtual,
    saldoLabel: "Valor atual",
  }));

  return (
    <div className="flex flex-col gap-6">
      <PillTabs tabs={tabs} param="tab" />

      {tab === "visao" && <VisaoGeral userId={user.id} hoje={hoje} />}
      {tab === "transacoes" && (
        <Card>
          <Transacoes
            userId={user.id}
            busca={busca}
            hoje={hoje}
            opcoesContas={opcoesContas}
            opcoesCategorias={opcoesCategorias}
            opcoesCartoes={opcoesCartoes}
            opcoesAtivos={opcoesAtivos}
          />
        </Card>
      )}
      {tab === "parcelamentos" && (
        <Parcelamentos
          userId={user.id}
          hoje={hoje}
          opcoesContas={opcoesContas}
          opcoesCategorias={opcoesCategorias}
          opcoesCartoes={opcoesCartoes}
        />
      )}
      {tab === "assinaturas" && <Assinaturas userId={user.id} />}
      {tab === "categorias" && <Categorias userId={user.id} hoje={hoje} />}
      {tab === "cartoes" && <Cartoes userId={user.id} hoje={hoje} />}
    </div>
  );
}

// ---------- Visão geral ----------

async function VisaoGeral({ userId, hoje }: { userId: string; hoje: Date }) {
  const [
    insight,
    resumo,
    ritmo,
    contas,
    faturas,
    cats,
    gastosDia,
    fluxo,
    vencimentos,
  ] = await Promise.all([
    insightFinanceiroPrincipal(userId, hoje),
    resumoDoMes(userId, hoje),
    ritmoDeGastos(userId, hoje),
    contasComSaldo(userId),
    faturasDosCartoes(userId, hoje),
    categoriasComparadas(userId, hoje),
    gastosPorDiaDoMes(userId, hoje),
    fluxoDeCaixa(userId, 6, hoje),
    proximosVencimentos(userId, 7, hoje),
  ]);

  const saldoTotal = contas.reduce((s, c) => s + c.saldo, 0);
  const totalCategorias = cats.reduce((s, c) => s + c.atual, 0);
  const topCats = cats.filter((c) => c.atual > 0).slice(0, 6);
  const mesRef = monthName(toSP(hoje));
  const prefixoMes = dayKeySP(hoje).slice(0, 8);

  return (
    <div className="stagger grid grid-cols-12 gap-6">
      <Card className="col-span-12">
        <HeroInsight
          insight={insight}
          miniCards={[
            {
              label: `Gasto em ${mesRef}`,
              value: formatBRL(resumo.gastoMes),
            },
            {
              label: "Vs. mês anterior",
              value:
                resumo.pct != null ? (
                  <VariationBadge pct={resumo.pct} upIsBad />
                ) : (
                  "—"
                ),
              sub: `${formatBRL(resumo.gastoMesAnterior)} no mês passado`,
            },
            {
              label: "Maior gasto",
              value: resumo.topCategoria
                ? `${resumo.topCategoria.emoji} ${resumo.topCategoria.nome}`
                : "—",
              sub: resumo.topCategoria
                ? formatBRL(resumo.topCategoria.total)
                : "sem gastos no mês",
            },
          ]}
        />
      </Card>

      <Card className="col-span-12 lg:col-span-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardLabel>Ritmo de gastos</CardLabel>
            <div className="mt-2 flex items-baseline gap-3">
              <HeroMoney centavos={resumo.acumuladoHoje} ticker />
              {resumo.pctRitmo != null && (
                <VariationBadge pct={resumo.pctRitmo} upIsBad />
              )}
            </div>
            <p className="mt-1.5 text-[12.5px] text-steel">
              {ritmo.acima ? "Acima" : "Abaixo"} do mesmo dia do mês passado (
              {formatBRL(resumo.acumuladoAnteriorMesmoDia)})
            </p>
          </div>
          <Link
            href="/financas?tab=transacoes"
            className="inline-flex shrink-0 items-center gap-1 text-[12.5px] text-mist transition-colors hover:text-mint"
          >
            ver todas
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Link>
        </div>
        <div className="mt-5">
          <RitmoChart data={ritmo.data} acima={ritmo.acima} />
        </div>
      </Card>

      <Card className="col-span-12 lg:col-span-4">
        <CardLabel>Contas correntes</CardLabel>
        <div className="mt-2">
          <HeroMoney centavos={saldoTotal} size="md" />
        </div>
        <div className="mt-4">
          {contas.length === 0 ? (
            <EmptyState icon={Wallet} title="Nenhuma conta cadastrada." />
          ) : (
            <>
              {contas.map((conta) => (
                <EntityRow
                  key={conta.id}
                  cor={conta.cor}
                  inicial={conta.nome}
                  nome={conta.nome}
                  subtitulo={rotuloConta[conta.tipo] ?? conta.tipo}
                  direita={formatBRL(conta.saldo)}
                />
              ))}
              <EntityListFooter>
                {contas.length} {contas.length === 1 ? "conta" : "contas"}
              </EntityListFooter>
            </>
          )}
        </div>
      </Card>

      <Card className="col-span-12 lg:col-span-5">
        <CardLabel>Top categorias do mês</CardLabel>
        <div className="mt-5">
          {topCats.length === 0 ? (
            <EmptyState icon={Layers} title="Sem gastos categorizados neste mês." />
          ) : (
            <BarList
              items={topCats.map((c) => ({
                id: c.id,
                label: c.nome,
                emoji: c.emoji,
                value: c.atual,
                valueLabel: formatBRL(c.atual),
                budgetPct: c.orcamentoMensal
                  ? (c.atual / c.orcamentoMensal) * 100
                  : null,
                sharePct:
                  totalCategorias > 0 ? (c.atual / totalCategorias) * 100 : 0,
              }))}
            />
          )}
        </div>
      </Card>

      <Card className="col-span-12 lg:col-span-4">
        <CardLabel>Gastos dia a dia</CardLabel>
        <div className="mt-5">
          <Heatmap
            cells={gastosDia.map((g) => ({
              key: `${prefixoMes}${String(g.dia).padStart(2, "0")}`,
              value: g.valor,
              label: `Dia ${g.dia}: ${formatBRL(g.valor)}`,
            }))}
            cor="255, 107, 107"
            columns={7}
          />
        </div>
        <p className="mt-4 text-[12.5px] text-steel">
          <span className="tabular text-ice">{formatBRL(resumo.gastoMes)}</span> em{" "}
          {mesRef}
        </p>
      </Card>

      <Card className="col-span-12 lg:col-span-3">
        <CardLabel>Próximos 7 dias</CardLabel>
        <div className="mt-4 flex flex-col">
          {vencimentos.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nada a vencer nesta semana." />
          ) : (
            vencimentos.slice(0, 6).map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 border-b border-stroke py-2.5 last:border-0"
              >
                <span className="text-[15px]">{v.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-ice">{v.titulo}</p>
                  <p className="tabular text-[11.5px] text-steel">
                    {shortDate(v.data)}
                  </p>
                </div>
                <span className="tabular text-[13px] text-mist">
                  {formatBRL(v.valor)}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="col-span-12 lg:col-span-8">
        <CardLabel>Fluxo de caixa · 6 meses</CardLabel>
        <div className="mt-5">
          <FluxoChart data={fluxo} />
        </div>
      </Card>

      <Card className="col-span-12 lg:col-span-4">
        <CardLabel>Faturas abertas</CardLabel>
        <div className="mt-4">
          {faturas.length === 0 ? (
            <EmptyState icon={Wallet} title="Nenhum cartão conectado." />
          ) : (
            faturas.map((f) => (
              <EntityRow
                key={f.id}
                cor={f.cor}
                inicial={f.nome}
                nome={f.nome}
                subtitulo={`${f.bandeira} · vence dia ${f.vencimento}`}
                direita={formatBRL(f.faturaAberta)}
                subDireita={`${Math.round(f.pctLimite)}% do limite`}
              />
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

// ---------- Transações ----------

async function Transacoes({
  userId,
  busca,
  hoje,
  opcoesContas,
  opcoesCategorias,
  opcoesCartoes,
  opcoesAtivos,
}: {
  userId: string;
  busca: Busca;
  hoje: Date;
  opcoesContas: { id: string; nome: string }[];
  opcoesCategorias: { id: string; nome: string; emoji: string; tipo: string }[];
  opcoesCartoes: { id: string; nome: string }[];
  opcoesAtivos: { id: string; nome: string }[];
}) {
  const intervalo = intervaloDoPeriodo(busca.periodo, hoje);
  const txs = await db.transaction.findMany({
    where: {
      userId,
      ...(intervalo ? { data: intervalo } : {}),
      ...(busca.conta ? { accountId: busca.conta } : {}),
      ...(busca.categoria ? { categoryId: busca.categoria } : {}),
      ...(busca.q ? { descricao: { contains: busca.q } } : {}),
    },
    orderBy: { data: "desc" },
    include: { category: true, account: true },
    take: 300,
  });

  const total = txs.reduce(
    (s, t) =>
      s + (t.tipo === "receita" ? t.valor : t.tipo === "despesa" ? -t.valor : 0),
    0
  );

  const nomePorPonta = new Map<string, string>();
  opcoesContas.forEach((c) => nomePorPonta.set(`conta:${c.id}`, c.nome));
  opcoesCartoes.forEach((c) => nomePorPonta.set(`cartao:${c.id}`, c.nome));
  opcoesAtivos.forEach((a) => nomePorPonta.set(`ativo:${a.id}`, a.nome));
  const nomeDaPonta = (tipo: string | null, id: string | null) =>
    tipo && id ? nomePorPonta.get(`${tipo}:${id}`) ?? "Excluído" : null;

  const linhas: LinhaTransacao[] = txs.map((t) => ({
    id: t.id,
    tipo: t.tipo,
    valor: t.valor,
    data: dayKeySP(t.data),
    dataLabel: shortDate(t.data),
    descricao: t.descricao,
    accountId: t.accountId,
    categoryId: t.categoryId,
    cardId: t.cardId,
    origemTipo: t.origemTipo as "conta" | "cartao" | "ativo" | null,
    origemId: t.origemId,
    origemNome: nomeDaPonta(t.origemTipo, t.origemId),
    destinoTipo: t.destinoTipo as "conta" | "cartao" | "ativo" | null,
    destinoId: t.destinoId,
    destinoNome: nomeDaPonta(t.destinoTipo, t.destinoId),
    tags: parseJSON<string[]>(t.tags, []),
    categoriaNome: t.category?.nome ?? null,
    categoriaEmoji: t.category?.emoji ?? null,
    contaNome: t.account?.nome ?? null,
    parcelaNum: t.parcelaNum,
    parcelaTotal: t.parcelaTotal,
  }));

  return (
    <>
      <CardLabel>Saldo do filtro</CardLabel>
      <div className="mt-2">
        <HeroMoney centavos={total} size="md" />
      </div>
      <p className="mt-1.5 text-[12.5px] text-steel">
        {linhas.length} {linhas.length === 1 ? "transação" : "transações"}
      </p>
      <div className="mt-6">
        <TransacoesClient
          linhas={linhas}
          contas={opcoesContas}
          categorias={opcoesCategorias}
          cartoes={opcoesCartoes}
          ativos={opcoesAtivos}
          hoje={dayKeySP(hoje)}
        />
      </div>
    </>
  );
}

// ---------- Parcelamentos ----------

async function Parcelamentos({
  userId,
  hoje,
  opcoesContas,
  opcoesCategorias,
  opcoesCartoes,
}: {
  userId: string;
  hoje: Date;
  opcoesContas: { id: string; nome: string }[];
  opcoesCategorias: { id: string; nome: string; emoji: string; tipo: string }[];
  opcoesCartoes: { id: string; nome: string }[];
}) {
  const itens = await parcelamentos(userId, hoje);
  const comprometidoMes = itens.reduce((s, p) => s + p.valorParcela, 0);

  return (
    <div className="stagger grid grid-cols-12 gap-6">
      <Card destaque className="col-span-12 lg:col-span-4">
        <CardLabel>Comprometido por mês</CardLabel>
        <div className="mt-2">
          <HeroMoney centavos={comprometidoMes} />
        </div>
        <p className="mt-2 text-[12.5px] text-mist">
          {itens.length}{" "}
          {itens.length === 1 ? "parcelamento ativo" : "parcelamentos ativos"}
        </p>
      </Card>

      <Card className="col-span-12 lg:col-span-8">
        <CardLabel>Todos os parcelamentos</CardLabel>
        <div className="mt-4">
          <ParcelamentosClient
            itens={itens.map((p) => ({
              grupo: p.grupo,
              descricao: p.descricao,
              valorParcela: p.valorParcela,
              total: p.total,
              pagas: p.pagas,
              parcelas: p.parcelas,
              proxima: p.proxima ? dayKeySP(p.proxima) : null,
              primeiraData: dayKeySP(p.primeiraData),
              accountId: p.accountId ?? "",
              categoryId: p.categoryId,
              cardId: p.cardId,
              tags: p.tags,
            }))}
            contas={opcoesContas}
            categorias={opcoesCategorias}
            cartoes={opcoesCartoes}
            hoje={dayKeySP(hoje)}
          />
        </div>
      </Card>
    </div>
  );
}

// ---------- Assinaturas ----------

async function Assinaturas({ userId }: { userId: string }) {
  const assinaturas = await db.subscription.findMany({
    where: { userId },
    orderBy: { nome: "asc" },
  });
  const ativas = assinaturas.filter((a) => a.status === "ativa");
  const mensal = ativas.reduce((s, a) => s + a.valor, 0);

  return (
    <div className="stagger grid grid-cols-12 gap-6">
      <Card destaque className="col-span-12 lg:col-span-4">
        <CardLabel>Assinaturas ativas</CardLabel>
        <div className="mt-2">
          <HeroMoney centavos={mensal} />
        </div>
        <p className="mt-2 text-[13px] text-mist">
          Você paga isso por mês em {ativas.length}{" "}
          {ativas.length === 1 ? "assinatura" : "assinaturas"} —{" "}
          {formatBRL(mensal * 12)} por ano.
        </p>
      </Card>

      <Card className="col-span-12 lg:col-span-8">
        <CardLabel>Todas as assinaturas</CardLabel>
        <div className="mt-4">
          <AssinaturasClient
            itens={assinaturas.map((a) => ({
              id: a.id,
              nome: a.nome,
              emoji: a.emoji,
              valor: a.valor,
              diaCobranca: a.diaCobranca,
              status: a.status as "ativa" | "pausada",
            }))}
          />
        </div>
      </Card>
    </div>
  );
}

// ---------- Categorias ----------

async function Categorias({ userId, hoje }: { userId: string; hoje: Date }) {
  const [categorias, cats] = await Promise.all([
    db.category.findMany({ where: { userId }, orderBy: { nome: "asc" } }),
    categoriasComparadas(userId, hoje),
  ]);
  const gastoPorCat = new Map(cats.map((c) => [c.id, c.atual]));
  const comOrcamento = cats.filter((c) => c.orcamentoMensal);

  return (
    <div className="stagger grid grid-cols-12 gap-6">
      <Card className="col-span-12 lg:col-span-7">
        <CardLabel>Categorias</CardLabel>
        <div className="mt-4">
          <CategoriasClient
            itens={categorias.map((c) => ({
              id: c.id,
              nome: c.nome,
              emoji: c.emoji,
              cor: c.cor,
              tipo: c.tipo as "despesa" | "receita",
              orcamentoMensal: c.orcamentoMensal,
              gastoMes: gastoPorCat.get(c.id) ?? 0,
            }))}
          />
        </div>
      </Card>

      <Card className="col-span-12 lg:col-span-5">
        <CardLabel>Orçamentos do mês</CardLabel>
        <div className="mt-5">
          {comOrcamento.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Defina um orçamento nas categorias para acompanhar aqui."
            />
          ) : (
            <BarList
              items={comOrcamento.map((c) => ({
                id: c.id,
                label: c.nome,
                emoji: c.emoji,
                value: c.atual,
                valueLabel: `${formatBRL(c.atual)} de ${formatBRL(
                  c.orcamentoMensal!
                )}`,
                budgetPct: (c.atual / c.orcamentoMensal!) * 100,
              }))}
            />
          )}
        </div>
      </Card>
    </div>
  );
}

// ---------- Cartões ----------

async function Cartoes({ userId, hoje }: { userId: string; hoje: Date }) {
  const faturas = await faturasDosCartoes(userId, hoje);
  return <CartoesClient faturas={faturas} />;
}
