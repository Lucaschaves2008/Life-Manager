import Link from "next/link";
import { ArrowUpRight, CalendarX2, Flame } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { Donut } from "@/components/caverna/donut";
import { EmptyState } from "@/components/caverna/empty-state";
import { GoalsChecklist } from "@/components/caverna/goals-checklist";
import { Heatmap } from "@/components/caverna/heatmap";
import { HeroInsight } from "@/components/caverna/hero-insight";
import { HeroMoney } from "@/components/caverna/hero-money";
import { Relogio } from "@/components/caverna/relogio";
import { StatCard } from "@/components/caverna/stat-card";
import { VariationBadge } from "@/components/caverna/variation-badge";
import { RitmoChart } from "@/components/charts/ritmo-chart";
import {
  eventosDeHoje,
  kcalHoje,
  proximoEvento,
  streakLC,
  treinosDaSemana,
} from "@/lib/data/home";
import { resumoDoMes, ritmoDeGastos } from "@/lib/data/financas";
import { insightDoDia } from "@/lib/data/insights-server";
import { db } from "@/lib/db";
import { formatBRL, formatPercent } from "@/lib/money";
import { fullDate, monthKeySP, monthName, nowSP } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const agora = nowSP();
  const mes = monthName(agora);

  const [
    insight,
    resumo,
    ritmo,
    eventos,
    treinos,
    kcal,
    streak,
    prox,
    metas,
  ] = await Promise.all([
    insightDoDia(agora),
    resumoDoMes(agora),
    ritmoDeGastos(agora),
    eventosDeHoje(agora),
    treinosDaSemana(agora),
    kcalHoje(agora),
    streakLC(agora),
    proximoEvento(agora),
    db.goal.findMany({
      where: { mes: monthKeySP(agora) },
      orderBy: { ordem: "asc" },
    }),
  ]);

  const kcalPct = kcal.meta > 0 ? (kcal.consumidas / kcal.meta) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting + relógio */}
      <header className="card-in flex items-end justify-between gap-6 pt-2">
        <div>
          <h1 className="display text-[40px] leading-none text-paper md:text-[52px]">
            Fala, Lucas.
          </h1>
          <p className="mt-2.5 text-[14px] text-mist">{fullDate(agora)}</p>
        </div>
        <Relogio dataLonga={fullDate(agora)} />
      </header>

      {/* Hero-Insight + Streak */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardLabel className="mb-4">Insight do dia</CardLabel>
          <HeroInsight
            insight={insight}
            miniCards={[
              {
                label: `Gasto em ${mes}`,
                value: formatBRL(resumo.gastoMes),
              },
              {
                label: "Vs. mês anterior",
                value:
                  resumo.pctRitmo !== null ? (
                    <span
                      className={
                        resumo.pctRitmo > 0 ? "text-coral" : "text-mint"
                      }
                    >
                      {resumo.pctRitmo > 0 ? "↗" : "↘"}{" "}
                      {formatPercent(Math.abs(resumo.pctRitmo), false)}
                    </span>
                  ) : (
                    "—"
                  ),
                sub: "no mesmo ponto do mês",
              },
              {
                label: "Maior gasto",
                value: resumo.topCategoria
                  ? `${resumo.topCategoria.emoji} ${resumo.topCategoria.nome}`
                  : "—",
                sub: resumo.topCategoria
                  ? formatBRL(resumo.topCategoria.total)
                  : undefined,
              },
            ]}
          />
        </Card>

        <Card className="flex flex-col xl:col-span-4">
          <CardLabel>Streak LC</CardLabel>
          <div className="mt-4 flex items-center gap-3">
            <Flame className="h-9 w-9 text-mint" strokeWidth={1.5} />
            <div>
              <p className="tabular text-[44px] font-semibold leading-none text-paper">
                {streak.streak}
              </p>
              <p className="mt-1 text-[12.5px] text-mist">
                dias seguidos no mínimo LC
              </p>
            </div>
          </div>
          <p className="mt-3 text-[12px] text-steel">
            ≥1 treino ou diário de dieta no dia · recorde:{" "}
            {Math.max(streak.streak, streak.recordeAnterior)}
          </p>
          <div className="mt-auto pt-5">
            <Heatmap
              cells={streak.heatmap}
              cor="62, 224, 143"
              columns={7}
              cellSize={12}
              max={1}
            />
            <p className="mt-2 text-[11px] text-steel">últimas 8 semanas</p>
          </div>
        </Card>
      </div>

      {/* Linha de 4 stat-cards */}
      <div className="stagger grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Gasto em ${mes}`}
          value={<HeroMoney centavos={resumo.gastoMes} size="md" />}
          pct={resumo.pctRitmo}
          upIsBad
        />
        <StatCard
          label="Treinos na semana"
          destaque={treinos.total >= treinos.meta}
          value={
            <span>
              {treinos.total}
              <span className="text-[15px] font-normal text-mist">
                {" "}
                de {treinos.meta}
              </span>
            </span>
          }
          extra={
            <span>
              {treinos.total >= treinos.meta
                ? "meta da semana batida"
                : `faltam ${treinos.meta - treinos.total} pra meta`}
            </span>
          }
        />
        <StatCard
          label="Kcal hoje"
          value={
            <div className="flex items-center gap-3">
              <Donut
                pct={kcalPct}
                size={46}
                strokeWidth={5}
                cor={kcalPct > 110 ? "var(--color-coral)" : "var(--color-mint)"}
                center={
                  <span className="text-[11px]">{Math.round(kcalPct)}%</span>
                }
              />
              <span className="tabular">
                {kcal.consumidas.toLocaleString("pt-BR")}
                <span className="text-[15px] font-normal text-mist">
                  {" "}
                  / {kcal.meta.toLocaleString("pt-BR")}
                </span>
              </span>
            </div>
          }
          extra={<span>consumidas vs meta</span>}
        />
        <StatCard
          label="Próximo evento"
          value={
            prox ? (
              <span className="flex items-center gap-2 text-[17px] leading-snug">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: prox.cor }}
                />
                {prox.titulo}
              </span>
            ) : (
              <span className="text-[16px] text-mist">Agenda livre</span>
            )
          }
          extra={<span>{prox ? prox.quando : "próximos 7 dias"}</span>}
        />
      </div>

      {/* Ritmo + Agenda de hoje + Metas */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardLabel>Ritmo de gastos</CardLabel>
              <div className="mt-3 flex items-baseline gap-2">
                <HeroMoney centavos={resumo.acumuladoHoje} size="lg" ticker />
                <span className="text-[13px] text-mist">
                  {ritmo.acima ? "acima" : "abaixo"}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[12.5px] text-steel">
                {resumo.pctRitmo !== null && (
                  <VariationBadge pct={resumo.pctRitmo} upIsBad />
                )}
                <span>
                  vs {formatBRL(resumo.acumuladoAnteriorMesmoDia)} mês anterior
                </span>
              </div>
            </div>
            <Link
              href="/financas"
              className="inline-flex items-center gap-1 text-[12.5px] text-mist transition-colors hover:text-mint"
            >
              ver finanças
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
          </div>
          <div className="mt-4">
            <RitmoChart
              data={ritmo.data}
              acima={ritmo.acima}
              height={180}
              compact
            />
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <div className="flex items-center justify-between">
            <CardLabel>Hoje na agenda</CardLabel>
            <Link
              href="/agenda"
              className="inline-flex items-center gap-1 text-[12.5px] text-mist transition-colors hover:text-mint"
            >
              ver agenda
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
          </div>
          {eventos.length === 0 ? (
            <EmptyState
              icon={CalendarX2}
              title="Nada na agenda de hoje. Aproveite para recarregar."
            />
          ) : (
            <ul className="mt-4 flex flex-col">
              {eventos.map((ev) => (
                <li
                  key={ev.id}
                  className="flex items-center gap-3 border-b border-stroke py-2.5 last:border-0"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: ev.cor }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] text-ice">
                      {ev.titulo}
                    </p>
                    <p className="text-[11.5px] text-steel">{ev.agenda}</p>
                  </div>
                  <span className="tabular shrink-0 text-[12.5px] text-mist">
                    {ev.hora ? `${ev.hora}` : "dia inteiro"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-3">
          <CardLabel className="mb-3">Metas de {mes}</CardLabel>
          <GoalsChecklist
            goals={metas.map((g) => ({
              id: g.id,
              titulo: g.titulo,
              feito: g.feito,
              mes: g.mes,
            }))}
          />
        </Card>
      </div>
    </div>
  );
}
