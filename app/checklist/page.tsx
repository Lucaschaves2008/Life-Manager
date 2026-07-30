import { Clock } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { ChecklistHoje } from "@/components/checklist/checklist-client";
import { MinhaRotina } from "@/components/checklist/rotina-client";
import { habitosAtivos, itensFeitosNoDia, percentualMensalHabitos } from "@/lib/data/checklist";
import { categoriasEstudo, formatHoras, sessoesDoDia } from "@/lib/data/estudos";
import {
  resumoSemanalRotina,
  rotinaPlanoDoDia,
  rotinaPlanos,
  rotinaTemplates,
  rotinasDoDia,
  rotinasParaPlano,
} from "@/lib/data/rotinas";
import { sessoesCorridaParaPlano } from "@/lib/data/treinos";
import { variaveisDoDia } from "@/lib/data/variaveis";
import { dayKeySP, fullDate, nowSP } from "@/lib/dates";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ChecklistPage() {
  const user = await getCurrentUser();
  const hoje = nowSP();
  const hojeKey = dayKeySP(hoje);

  const [
    habitos,
    feitos,
    pctMensalHabitos,
    semana,
    sessoesHoje,
    categorias,
    rotinasTreino,
    sessoesCorrida,
    rotinaOcorrencias,
    todasRotinas,
    planos,
    planoAtivoId,
    variaveis,
  ] = await Promise.all([
    habitosAtivos(user.id),
    itensFeitosNoDia(user.id, hoje),
    percentualMensalHabitos(user.id, hoje),
    resumoSemanalRotina(user.id, 7, hoje),
    sessoesDoDia(user.id, hoje),
    categoriasEstudo(user.id),
    rotinasParaPlano(user.id),
    sessoesCorridaParaPlano(user.id),
    rotinasDoDia(user.id, hoje),
    rotinaTemplates(user.id),
    rotinaPlanos(user.id),
    rotinaPlanoDoDia(user.id, hoje),
    variaveisDoDia(user.id, hoje),
  ]);

  const totalItens = rotinaOcorrencias.length + variaveis.length;
  const totalFeitos =
    rotinaOcorrencias.filter((oc) => oc.feito).length + variaveis.filter((v) => v.feito).length;
  const pctHoje = totalItens > 0 ? (totalFeitos / totalItens) * 100 : 0;
  const segundosEstudoHoje = sessoesHoje.reduce((s, sessao) => s + sessao.liquidoSec, 0);

  return (
    <div className="stagger flex flex-col gap-6">
      <header className="card-in pt-2">
        <h1 className="display text-[32px] leading-none text-paper md:text-[38px]">
          Checklist
        </h1>
        <p className="mt-2.5 text-[14px] text-mist first-letter:uppercase">
          {fullDate(hoje)}
        </p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <Card destaque={pctHoje >= 100} className="col-span-12 lg:col-span-4">
          <CardLabel>Progresso de hoje</CardLabel>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="display text-[34px] leading-none text-paper">
              {Math.round(pctHoje)}%
            </span>
            <span className="text-[13px] text-steel">
              {totalFeitos} de {totalItens} itens
            </span>
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-mint transition-all duration-500"
              style={{ width: `${Math.min(100, pctHoje)}%` }}
            />
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-4">
          <CardLabel>Tempo de estudo hoje</CardLabel>
          <div className="mt-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-mist" strokeWidth={1.5} />
            <span className="display text-[26px] leading-none text-paper">
              {formatHoras(segundosEstudoHoje)}
            </span>
          </div>
          <p className="mt-3 text-[12.5px] text-steel">
            {sessoesHoje.length === 0
              ? "Nenhuma sessão registrada hoje."
              : `${sessoesHoje.length} sessão(ões) registrada(s).`}
          </p>
        </Card>

        <Card className="col-span-12 lg:col-span-4">
          <CardLabel>Últimos 7 dias</CardLabel>
          <div className="mt-5 flex items-end justify-between gap-1.5" style={{ height: 60 }}>
            {semana.map((d) => (
              <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-full w-full items-end">
                  <div
                    className={cn(
                      "w-full rounded-t-[4px]",
                      d.key === hojeKey ? "bg-mint" : "bg-surface-2"
                    )}
                    style={{ height: `${Math.max(4, d.pct)}%` }}
                  />
                </div>
                <span className="text-[10px] text-steel">{d.label.slice(0, 2)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="col-span-12">
          <MinhaRotina
            ocorrencias={rotinaOcorrencias}
            templates={todasRotinas}
            categorias={categorias}
            rotinasTreino={rotinasTreino}
            sessoesCorrida={sessoesCorrida}
            planos={planos}
            planoAtivoId={planoAtivoId}
            variaveis={variaveis}
            dia={hojeKey}
          />
        </Card>

        <Card className="col-span-12">
          <ChecklistHoje
            habitos={habitos}
            feitos={feitos}
            pctMensal={pctMensalHabitos}
            hoje={hojeKey}
          />
        </Card>
      </div>
    </div>
  );
}
