import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3, ChevronLeft, Flame, NotebookPen } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { EmptyState } from "@/components/caverna/empty-state";
import { StatCard } from "@/components/caverna/stat-card";
import { CadernoTopico } from "@/components/estudos/caderno-topico";
import { PorDiaSemana, PorHora } from "@/components/estudos/distribuicao";
import { SemanasChart } from "@/components/estudos/semanas-chart";
import { SessoesTopico } from "@/components/estudos/sessoes-topico";
import { detalheTopico, formatHoras, rotuloDesde } from "@/lib/data/estudos";
import { mediumDate, nowSP } from "@/lib/dates";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TopicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  const { id } = await params;
  const hoje = nowSP();
  const t = await detalheTopico(user.id, id, hoje);
  if (!t) notFound();

  const semDados = t.sessoes === 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="card-in pt-2">
        <Link
          href="/estudos/topicos"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-steel transition-colors hover:text-ice"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          Tópicos
        </Link>
        <div className="mt-3 flex items-center gap-3.5">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] text-[24px]"
            style={{ background: `color-mix(in srgb, ${t.cor} 14%, transparent)` }}
          >
            {t.emoji}
          </span>
          <div className="min-w-0">
            <h1 className="display truncate text-[30px] leading-none text-paper md:text-[36px]">
              {t.nome}
            </h1>
            <p className="mt-2 text-[13px] text-mist">
              {t.primeiraISO
                ? `desde ${mediumDate(new Date(t.primeiraISO))} · último estudo ${rotuloDesde(t.ultimaISO, hoje)}`
                : "nenhuma sessão registrada"}
              {!t.ativo && " · categoria arquivada"}
            </p>
          </div>
        </div>
      </header>

      {semDados ? (
        <Card>
          <EmptyState
            icon={BarChart3}
            title="Ainda sem sessões neste tópico"
            description="Escolha esta categoria no cronômetro e comece a estudar — as métricas e o caderno aparecem aqui."
          />
        </Card>
      ) : (
        <>
          {/* KPIs principais */}
          <div className="stagger grid grid-cols-2 gap-4 md:gap-5 xl:grid-cols-4">
            <StatCard
              label="Total estudado"
              destaque
              value={formatHoras(t.totalSec)}
              extra={
                <span>
                  {t.sessoes} {t.sessoes === 1 ? "sessão" : "sessões"}
                </span>
              }
            />
            <StatCard
              label="Média por sessão"
              value={formatHoras(t.mediaSessaoSec)}
              extra={<span>duração típica</span>}
            />
            <StatCard
              label="Média semanal"
              value={formatHoras(t.mediaSemanalSec)}
              extra={<span>desde a 1ª sessão</span>}
            />
            <StatCard
              label="Média por dia ativo"
              value={formatHoras(t.mediaDiaAtivoSec)}
              extra={
                <span>
                  {t.diasAtivos} {t.diasAtivos === 1 ? "dia" : "dias"} com estudo
                </span>
              }
            />
          </div>

          {/* KPIs secundários */}
          <div className="grid grid-cols-2 gap-4 md:gap-5 xl:grid-cols-4">
            <StatCard
              label="Sequência"
              value={`${t.streak} ${t.streak === 1 ? "dia" : "dias"}`}
              extra={
                <span className="inline-flex items-center gap-1.5">
                  <Flame className="h-4 w-4 text-mint" strokeWidth={1.5} />
                  dias seguidos
                </span>
              }
            />
            <StatCard
              label="Melhor semana"
              value={formatHoras(t.melhorSemanaSec)}
              extra={<span>{t.melhorSemanaLabel}</span>}
            />
            <StatCard
              label="Melhor dia"
              value={formatHoras(t.melhorDiaSec)}
              extra={<span>{t.melhorDiaLabel}</span>}
            />
            <StatCard
              label="Foco"
              value={`${t.focoPct}%`}
              extra={<span>{formatHoras(t.pausadoSec)} em pausa</span>}
            />
          </div>

          {/* Evolução + subtópicos */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <Card className="xl:col-span-8">
              <CardLabel>Horas por semana · últimas 12 semanas</CardLabel>
              <div className="mt-5">
                <SemanasChart data={t.semanas} cor={t.cor} />
              </div>
            </Card>

            <Card className="xl:col-span-4">
              <CardLabel className="mb-4">
                Subtópicos · {t.subtopicos}
              </CardLabel>
              {t.subtopicosLista.length === 0 ? (
                <p className="text-[13px] text-steel">Nenhum subtópico.</p>
              ) : (
                <div className="flex flex-col">
                  {t.subtopicosLista.map((s) => (
                    <div
                      key={s.subject}
                      className="border-b border-stroke py-2.5 last:border-0"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-[13.5px] text-ice">
                          {s.subject}
                        </p>
                        <span className="tabular shrink-0 text-[13px] text-mist">
                          {formatHoras(s.segundos)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(s.segundos / Math.max(1, t.subtopicosLista[0].segundos)) * 100}%`,
                            background: t.cor,
                          }}
                        />
                      </div>
                      <p className="tabular mt-1.5 text-[11px] text-steel">
                        {s.sessoes} {s.sessoes === 1 ? "sessão" : "sessões"} ·
                        média {formatHoras(s.mediaSec)} ·{" "}
                        {rotuloDesde(s.ultimaISO, hoje)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Padrões */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Card>
              <CardLabel className="mb-5">Por dia da semana</CardLabel>
              <PorDiaSemana dados={t.porDiaSemana} cor={t.cor} />
            </Card>
            <Card>
              <CardLabel className="mb-5">
                Por horário · quando você começa
              </CardLabel>
              <PorHora dados={t.porHora} cor={t.cor} />
            </Card>
          </div>

          {/* Caderno */}
          <Card>
            <CardLabel className="mb-4 inline-flex items-center gap-1.5">
              <NotebookPen className="h-3.5 w-3.5" strokeWidth={1.5} />
              Caderno · {t.notas} {t.notas === 1 ? "nota" : "notas"}
            </CardLabel>
            {t.notasLista.length === 0 ? (
              <EmptyState
                icon={NotebookPen}
                title="Nenhuma nota neste tópico"
                description="Escreva no campo de notas do cronômetro enquanto estuda — tudo o que você anotar fica guardado aqui."
              />
            ) : (
              <CadernoTopico notas={t.notasLista} />
            )}
          </Card>

          {/* Histórico */}
          <Card>
            <CardLabel className="mb-4">
              Todas as sessões · {t.sessoes}
            </CardLabel>
            <SessoesTopico sessoes={t.sessoesLista} />
          </Card>
        </>
      )}
    </div>
  );
}
