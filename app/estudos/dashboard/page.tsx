import Link from "next/link";
import { BarChart3, BookOpen, ChevronRight, Flame } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { Donut } from "@/components/caverna/donut";
import { EmptyState } from "@/components/caverna/empty-state";
import { PillTabs } from "@/components/caverna/pill-tabs";
import { StatCard } from "@/components/caverna/stat-card";
import { HorasChart } from "@/components/estudos/horas-chart";
import { ESTUDOS_TABS } from "@/components/estudos/tabs";
import {
  dashboardEstudos,
  formatHoras,
  rotuloDesde,
  topicosEstudo,
} from "@/lib/data/estudos";
import { fullDate, nowSP } from "@/lib/dates";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EstudosDashboardPage() {
  const user = await getCurrentUser();
  const hoje = nowSP();
  const [dash, topicos] = await Promise.all([
    dashboardEstudos(user.id, hoje),
    topicosEstudo(user.id, hoje),
  ]);

  // o gráfico de 14 dias é uma janela; a distribuição por tópico é de sempre
  const comEstudo = topicos.filter((t) => t.totalSec > 0);
  const totalSegTopico = comEstudo.reduce((s, t) => s + t.totalSec, 0);
  const semDados = totalSegTopico === 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="card-in pt-2">
        <h1 className="display text-[32px] leading-none text-paper md:text-[38px]">
          Estudos
        </h1>
        <p className="mt-2.5 text-[14px] text-mist first-letter:uppercase">
          {fullDate(hoje)}
        </p>
      </header>

      <PillTabs tabs={ESTUDOS_TABS} />

      {/* KPIs */}
      <div className="stagger grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Estudado hoje"
          destaque={dash.horasHoje > 0}
          value={formatHoras(Math.round(dash.horasHoje * 3600))}
          extra={<span>{dash.sessoesHoje} sessões</span>}
        />
        <StatCard
          label="Média semanal"
          value={`${dash.mediaSemanalHoras.toLocaleString("pt-BR", {
            maximumFractionDigits: 1,
          })} h`}
          extra={<span>média das últimas 4 semanas</span>}
        />
        <StatCard
          label="Nesta semana"
          value={formatHoras(Math.round(dash.totalSemanaHoras * 3600))}
          extra={<span>últimos 7 dias</span>}
        />
        <StatCard
          label="Sequência"
          value={`${dash.streak} ${dash.streak === 1 ? "dia" : "dias"}`}
          extra={
            <span className="inline-flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-mint" strokeWidth={1.5} />
              dias seguidos estudando
            </span>
          }
        />
      </div>

      {/* Gráfico de horas por dia + distribuição por tópico */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardLabel>Horas por dia · últimos 14 dias</CardLabel>
          <div className="mt-5">
            {semDados ? (
              <EmptyState
                icon={BarChart3}
                title="Sem estudos registrados ainda"
                description="Comece uma sessão no cronômetro para construir seu histórico."
              />
            ) : (
              <HorasChart data={dash.porDia} />
            )}
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <CardLabel>Por tópico · todo o histórico</CardLabel>
          <div className="mt-5">
            {semDados ? (
              <EmptyState
                icon={BookOpen}
                title="Nenhum tópico ainda"
                description="Os tópicos aparecem aqui conforme você registra sessões de estudo."
              />
            ) : (
              <Donut
                segments={comEstudo.map((t) => ({
                  label: t.nome,
                  value: t.totalSec,
                  cor: t.cor,
                }))}
                legend
                formatValue={(v) => formatHoras(v)}
                center={formatHoras(totalSegTopico)}
                centerSub="total"
                size={132}
              />
            )}
          </div>
        </Card>
      </div>

      {/* Detalhamento por tópico */}
      {!semDados && (
        <Card>
          <CardLabel className="mb-4">
            Detalhe por tópico · toque para ver tudo
          </CardLabel>
          <div className="flex flex-col">
            {comEstudo.map((t) => (
              <Link
                key={t.id}
                href={`/estudos/topicos/${t.id}`}
                className="group flex items-center gap-3 border-b border-stroke py-3 last:border-0"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: t.cor }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] text-ice">
                    <span className="mr-1.5">{t.emoji}</span>
                    {t.nome}
                  </p>
                  <p className="text-[11.5px] text-steel">
                    {t.sessoes} {t.sessoes === 1 ? "sessão" : "sessões"} · média{" "}
                    {formatHoras(t.mediaSessaoSec)} ·{" "}
                    {formatHoras(t.mediaSemanalSec)}/sem ·{" "}
                    {rotuloDesde(t.ultimaISO, hoje)}
                  </p>
                </div>
                <span className="tabular shrink-0 text-[13.5px] text-mist">
                  {formatHoras(t.totalSec)}
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-steel transition-transform group-hover:translate-x-0.5"
                  strokeWidth={1.5}
                />
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
