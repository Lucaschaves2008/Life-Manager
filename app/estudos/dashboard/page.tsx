import { BarChart3, BookOpen, Flame } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { Donut } from "@/components/caverna/donut";
import { EmptyState } from "@/components/caverna/empty-state";
import { PillTabs } from "@/components/caverna/pill-tabs";
import { StatCard } from "@/components/caverna/stat-card";
import { HorasChart } from "@/components/estudos/horas-chart";
import { dashboardEstudos, formatHoras } from "@/lib/data/estudos";
import { fullDate, nowSP } from "@/lib/dates";

export const dynamic = "force-dynamic";

const tabs = [
  { label: "Cronômetro", href: "/estudos" },
  { label: "Dashboard", href: "/estudos/dashboard" },
];

const coresAssunto = [
  "var(--color-mint)",
  "var(--cal-blue)",
  "var(--cal-amber)",
  "var(--cal-teal)",
  "var(--cal-lilac)",
  "var(--color-steel)",
];

export default async function EstudosDashboardPage() {
  const hoje = nowSP();
  const dash = await dashboardEstudos(hoje);

  const totalSegAssunto = dash.porAssunto.reduce((s, a) => s + a.segundos, 0);
  const semDados = totalSegAssunto === 0;

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

      <PillTabs tabs={tabs} />

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

      {/* Gráfico de horas por dia + por assunto */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardLabel>Horas por dia · últimos 14 dias</CardLabel>
          <div className="mt-5">
            {semDados ? (
              <EmptyState
                icon={BarChart3}
                title="Sem estudos registrados ainda. Comece uma sessão no cronômetro."
              />
            ) : (
              <HorasChart data={dash.porDia} />
            )}
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <CardLabel>Por assunto</CardLabel>
          <div className="mt-5">
            {semDados ? (
              <EmptyState icon={BookOpen} title="Nenhum assunto ainda." />
            ) : (
              <Donut
                segments={dash.porAssunto.map((a, i) => ({
                  label: a.subject,
                  value: a.segundos,
                  cor: coresAssunto[i % coresAssunto.length],
                }))}
                legend
                formatValue={(v) => formatHoras(v)}
                center={formatHoras(totalSegAssunto)}
                centerSub="total"
                size={132}
              />
            )}
          </div>
        </Card>
      </div>

      {/* Detalhamento por assunto */}
      {!semDados && (
        <Card>
          <CardLabel className="mb-4">Detalhe por assunto</CardLabel>
          <div className="flex flex-col">
            {dash.porAssunto.map((a, i) => (
              <div
                key={a.subject}
                className="flex items-center gap-3 border-b border-stroke py-3 last:border-0"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: coresAssunto[i % coresAssunto.length] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] text-ice">{a.subject}</p>
                  <p className="text-[11.5px] text-steel">
                    {a.sessoes} {a.sessoes === 1 ? "sessão" : "sessões"}
                  </p>
                </div>
                <span className="tabular text-[13.5px] text-mist">
                  {formatHoras(a.segundos)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
