import { BookOpen, Clock, Timer } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { EmptyState } from "@/components/caverna/empty-state";
import { PillTabs } from "@/components/caverna/pill-tabs";
import { Cronometro } from "@/components/estudos/cronometro";
import { SessoesDoDia } from "@/components/estudos/sessoes-dia";
import {
  dashboardEstudos,
  formatHoras,
  sessaoEmAndamento,
  sessoesDoDia,
} from "@/lib/data/estudos";
import { fullDate, nowSP } from "@/lib/dates";

export const dynamic = "force-dynamic";

const tabs = [
  { label: "Cronômetro", href: "/estudos" },
  { label: "Dashboard", href: "/estudos/dashboard" },
];

export default async function EstudosPage() {
  const hoje = nowSP();
  const [ativa, doDia, dash] = await Promise.all([
    sessaoEmAndamento(),
    sessoesDoDia(hoje),
    dashboardEstudos(hoje),
  ]);

  // a sessão em andamento não entra na lista de "concluídas de hoje"
  const concluidas = doDia.filter((s) => !s.emAndamento);

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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Cronômetro */}
        <Card className="xl:col-span-7">
          <Cronometro sessaoInicial={ativa} />
        </Card>

        {/* Resumo de hoje + sessões */}
        <div className="flex flex-col gap-6 xl:col-span-5">
          <div className="grid grid-cols-2 gap-4">
            <Card className="flex flex-col gap-2 p-5" destaque={dash.horasHoje > 0}>
              <CardLabel>Estudado hoje</CardLabel>
              <p className="tabular text-[26px] font-semibold leading-none text-paper">
                {formatHoras(Math.round(dash.horasHoje * 3600))}
              </p>
              <p className="mt-auto flex items-center gap-1.5 text-[12px] text-steel">
                <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                líquido
              </p>
            </Card>
            <Card className="flex flex-col gap-2 p-5">
              <CardLabel>Sessões hoje</CardLabel>
              <p className="tabular text-[26px] font-semibold leading-none text-paper">
                {dash.sessoesHoje}
              </p>
              <p className="mt-auto flex items-center gap-1.5 text-[12px] text-steel">
                <Timer className="h-3.5 w-3.5" strokeWidth={1.5} />
                média {dash.mediaSemanalHoras.toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                })}
                h/sem
              </p>
            </Card>
          </div>

          <Card className="flex-1">
            <CardLabel className="mb-4">Sessões de hoje</CardLabel>
            {concluidas.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="Nenhuma sessão concluída hoje. Inicie o cronômetro para registrar seu primeiro estudo."
              />
            ) : (
              <SessoesDoDia sessoes={concluidas} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
