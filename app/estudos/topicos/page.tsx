import Link from "next/link";
import { BookOpen, ChevronRight, NotebookPen } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { EmptyState } from "@/components/caverna/empty-state";
import { PillTabs } from "@/components/caverna/pill-tabs";
import { Sparkline } from "@/components/caverna/sparkline";
import { ESTUDOS_TABS } from "@/components/estudos/tabs";
import { formatHoras, rotuloDesde, topicosEstudo } from "@/lib/data/estudos";
import { fullDate, nowSP } from "@/lib/dates";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EstudosTopicosPage() {
  const user = await getCurrentUser();
  const hoje = nowSP();
  const topicos = await topicosEstudo(user.id, hoje);

  const totalSec = topicos.reduce((s, t) => s + t.totalSec, 0);
  const totalSessoes = topicos.reduce((s, t) => s + t.sessoes, 0);
  const totalNotas = topicos.reduce((s, t) => s + t.notas, 0);
  const comEstudo = topicos.filter((t) => t.totalSec > 0);

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

      {topicos.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="Nenhum tópico ainda"
            description="Crie uma categoria no cronômetro e comece a estudar — cada categoria vira um tópico com histórico, médias e caderno de notas."
          />
        </Card>
      ) : (
        <>
          {/* Totais de todo o histórico */}
          <Card className="flex flex-wrap items-center gap-x-10 gap-y-4 py-5">
            <div>
              <CardLabel>Total estudado</CardLabel>
              <p className="tabular mt-1.5 text-[24px] font-semibold leading-none text-paper">
                {formatHoras(totalSec)}
              </p>
            </div>
            <div>
              <CardLabel>Sessões</CardLabel>
              <p className="tabular mt-1.5 text-[24px] font-semibold leading-none text-paper">
                {totalSessoes}
              </p>
            </div>
            <div>
              <CardLabel>Tópicos</CardLabel>
              <p className="tabular mt-1.5 text-[24px] font-semibold leading-none text-paper">
                {comEstudo.length}
              </p>
            </div>
            <div>
              <CardLabel>Notas escritas</CardLabel>
              <p className="tabular mt-1.5 text-[24px] font-semibold leading-none text-paper">
                {totalNotas}
              </p>
            </div>
            <p className="ml-auto text-[12px] text-steel">todo o histórico</p>
          </Card>

          <div className="stagger grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {topicos.map((t) => (
              <Link key={t.id} href={`/estudos/topicos/${t.id}`} className="block">
                <Card className="group flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-[17px]"
                      style={{ background: `color-mix(in srgb, ${t.cor} 14%, transparent)` }}
                    >
                      {t.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] text-paper">{t.nome}</p>
                      <p className="text-[11.5px] text-steel">
                        {t.sessoes} {t.sessoes === 1 ? "sessão" : "sessões"}
                        {t.subtopicos > 0 &&
                          ` · ${t.subtopicos} ${t.subtopicos === 1 ? "subtópico" : "subtópicos"}`}
                        {!t.ativo && " · arquivado"}
                      </p>
                    </div>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-steel transition-transform group-hover:translate-x-0.5"
                      strokeWidth={1.5}
                    />
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    <p className="tabular text-[22px] font-semibold leading-none text-paper">
                      {formatHoras(t.totalSec)}
                    </p>
                    <div className="w-[92px]">
                      <Sparkline serie={t.serie12} cor={t.cor} />
                    </div>
                  </div>

                  <div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-2 border-t border-stroke pt-3 text-[11.5px]">
                    <div>
                      <span className="text-steel">média/sessão </span>
                      <span className="tabular text-mist">
                        {formatHoras(t.mediaSessaoSec)}
                      </span>
                    </div>
                    <div>
                      <span className="text-steel">por semana </span>
                      <span className="tabular text-mist">
                        {formatHoras(t.mediaSemanalSec)}
                      </span>
                    </div>
                    <div>
                      <span className="text-steel">último </span>
                      <span className="text-mist">
                        {rotuloDesde(t.ultimaISO, hoje)}
                      </span>
                    </div>
                    {t.notas > 0 && (
                      <div className="inline-flex items-center gap-1.5 text-mist">
                        <NotebookPen className="h-3.5 w-3.5" strokeWidth={1.5} />
                        {t.notas} {t.notas === 1 ? "nota" : "notas"}
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
