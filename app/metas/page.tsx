import Link from "next/link";
import { ChevronLeft, ChevronRight, Target, TrendingUp } from "lucide-react";
import { addMonths, subMonths } from "date-fns";
import { Card, CardLabel } from "@/components/caverna/card";
import { Donut } from "@/components/caverna/donut";
import { GoalsChecklist } from "@/components/caverna/goals-checklist";
import { AreaEvolucao } from "@/components/metas/area-evolucao";
import { MetasQuantitativasList } from "@/components/metas/metas-quantitativas-list";
import { db } from "@/lib/db";
import { evolucaoAreas } from "@/lib/data/metas";
import { metasQuantitativas } from "@/lib/data/metas-quantitativas";
import { variaveisAtivas } from "@/lib/data/variaveis";
import { monthKeySP, monthYear, nowSP } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function mesParaData(mes: string): Date {
  return new Date(`${mes}-15T12:00:00-03:00`);
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const user = await getCurrentUser();
  const { mes: mesParam } = await searchParams;
  const agora = nowSP();
  const hojeMes = monthKeySP(agora);
  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? "") ? mesParam! : hojeMes;
  const referencia = mesParaData(mes);
  const ehMesAtual = mes === hojeMes;

  const [goals, historicoRaw, areas, metasQtd, variaveis] = await Promise.all([
    db.goal.findMany({
      where: { userId: user.id, mes },
      orderBy: [{ ordem: "asc" }, { id: "asc" }],
    }),
    // histórico: todas as metas de todos os meses (agrupamos p/ % concluído)
    db.goal.findMany({
      where: { userId: user.id },
      select: { mes: true, feito: true },
    }),
    // painel de evolução: só faz sentido no mês corrente (dados "de agora")
    ehMesAtual ? evolucaoAreas(user.id, agora) : Promise.resolve([]),
    // metas quantitativas: sempre "de agora", período próprio de cada meta
    metasQuantitativas(user.id, agora),
    variaveisAtivas(user.id),
  ]);

  const feitas = goals.filter((g) => g.feito).length;
  const pct = goals.length > 0 ? (feitas / goals.length) * 100 : 0;
  const completo = goals.length > 0 && feitas === goals.length;

  // agrega o histórico por mês (últimos 8 meses com metas)
  const porMes = new Map<string, { total: number; feitas: number }>();
  for (const g of historicoRaw) {
    const acc = porMes.get(g.mes) ?? { total: 0, feitas: 0 };
    acc.total += 1;
    if (g.feito) acc.feitas += 1;
    porMes.set(g.mes, acc);
  }
  const historico = [...porMes.entries()]
    .map(([m, v]) => ({
      mes: m,
      pct: v.total > 0 ? (v.feitas / v.total) * 100 : 0,
      completo: v.total > 0 && v.feitas === v.total,
    }))
    .sort((a, b) => (a.mes < b.mes ? 1 : -1))
    .slice(0, 8);

  // meses fechados 100% (badge motivacional no hero)
  const mesesFechados = [...porMes.values()].filter(
    (v) => v.total > 0 && v.feitas === v.total
  ).length;

  const anterior = monthKeySP(subMonths(referencia, 1));
  const proximo = monthKeySP(addMonths(referencia, 1));

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <header className="card-in flex flex-wrap items-end justify-between gap-4 pt-2">
        <div>
          <p className="microlabel text-steel">Metas &amp; evolução</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <h1 className="display text-[30px] capitalize leading-none text-paper md:text-[34px]">
              {monthYear(referencia)}
            </h1>
            <div className="flex items-center gap-1">
              <Link
                href={`/metas?mes=${anterior}`}
                aria-label="Mês anterior"
                className="rounded-full p-2 text-mist transition-colors hover:bg-surface-2 hover:text-ice"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
              </Link>
              <Link
                href={`/metas?mes=${proximo}`}
                aria-label="Próximo mês"
                className="rounded-full p-2 text-mist transition-colors hover:bg-surface-2 hover:text-ice"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
              </Link>
            </div>
            {!ehMesAtual && (
              <Link
                href="/metas"
                className="rounded-full border border-stroke px-3 py-1 text-[12.5px] text-mist transition-colors hover:border-mint hover:text-mint"
              >
                Voltar para hoje
              </Link>
            )}
          </div>
        </div>

        {mesesFechados > 0 && (
          <div className="flex items-center gap-2 rounded-full border border-stroke bg-surface px-3.5 py-1.5">
            <Target className="h-4 w-4 text-mint" strokeWidth={1.5} />
            <span className="text-[12.5px] text-mist">
              <span className="tabular font-semibold text-paper">
                {mesesFechados}
              </span>{" "}
              {mesesFechados === 1 ? "mês fechado" : "meses fechados"} 100%
            </span>
          </div>
        )}
      </header>

      {/* Hero: checklist + progresso */}
      <div className="stagger grid grid-cols-12 gap-6">
        <Card className="col-span-12 lg:col-span-7">
          <div className="flex items-center justify-between">
            <CardLabel>Metas do mês</CardLabel>
            {goals.length > 0 && (
              <span className="tabular text-[12px] text-steel">
                {feitas}/{goals.length}
              </span>
            )}
          </div>
          <div className="mt-4">
            <GoalsChecklist goals={goals} mes={mes} />
          </div>
        </Card>

        <Card destaque={completo} className="col-span-12 lg:col-span-5">
          <CardLabel>Progresso</CardLabel>
          <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
            <Donut
              pct={pct}
              size={156}
              strokeWidth={13}
              center={`${Math.round(pct)}%`}
              centerSub={
                goals.length > 0 ? `${feitas} de ${goals.length}` : "sem metas"
              }
              cor={completo ? "var(--color-mint)" : "var(--color-steel)"}
              className="justify-center"
            />
            <p className="text-center text-[13px] leading-relaxed text-mist sm:text-left lg:text-center">
              {goals.length === 0
                ? "Defina as metas deste mês para acompanhar o progresso aqui."
                : completo
                ? "Mês fechado — todas as metas concluídas. 🎯"
                : `Faltam ${goals.length - feitas} ${
                    goals.length - feitas === 1 ? "meta" : "metas"
                  } para fechar o mês.`}
            </p>
          </div>
        </Card>
      </div>

      {/* Metas quantitativas: alvo numérico com progresso automático */}
      <Card>
        <div className="flex items-center justify-between">
          <CardLabel>Metas quantitativas</CardLabel>
          {metasQtd.length > 0 && (
            <span className="tabular text-[12px] text-steel">
              {metasQtd.filter((m) => m.pct >= 100).length}/{metasQtd.length} concluídas
            </span>
          )}
        </div>
        <div className="mt-4">
          <MetasQuantitativasList metas={metasQtd} variaveis={variaveis} />
        </div>
      </Card>

      {/* Painel de evolução das áreas (só no mês atual) */}
      {ehMesAtual && areas.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-mint" strokeWidth={1.5} />
            <CardLabel className="text-mist">Evolução do mês</CardLabel>
            <span className="text-[12px] text-steel">
              · progresso em cada área — toque para ver detalhes
            </span>
          </div>
          <div className="stagger grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {areas.map((area) => (
              <AreaEvolucao key={area.key} area={area} />
            ))}
          </div>
        </section>
      )}

      {/* Histórico de metas */}
      <Card className="col-span-12">
        <CardLabel>Histórico de metas</CardLabel>
        <div className="mt-4 flex flex-wrap gap-2">
          {historico.length === 0 && (
            <p className="flex items-center gap-2 py-2 text-[13px] text-steel">
              <Target className="h-4 w-4" strokeWidth={1.5} />
              Nenhum mês com metas registradas ainda.
            </p>
          )}
          {historico.map((h) => (
            <Link
              key={h.mes}
              href={`/metas?mes=${h.mes}`}
              className={cn(
                "group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] capitalize transition-colors",
                h.mes === mes
                  ? "border-[var(--mint-border)] bg-mint-soft text-mint"
                  : "border-stroke text-mist hover:border-[var(--stroke-hover)] hover:text-ice"
              )}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  background: h.completo
                    ? "var(--color-mint)"
                    : h.pct > 0
                    ? "var(--cal-amber)"
                    : "var(--color-surface-2)",
                }}
              />
              {monthYear(mesParaData(h.mes))}
              <span className="tabular text-[11px] text-steel group-hover:text-mist">
                {Math.round(h.pct)}%
              </span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
