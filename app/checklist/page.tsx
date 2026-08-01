import { Clock } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { ChecklistHoje } from "@/components/checklist/checklist-client";
import { DiaRegistroCard } from "@/components/checklist/dia-registro-client";
import { HistoricoChecklist } from "@/components/checklist/historico-checklist";
import { MinhaRotina } from "@/components/checklist/rotina-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { habitosAtivos, itensFeitosNoDia, percentualMensalHabitos } from "@/lib/data/checklist";
import { aguaDoDiaChecklist, refeicoesDoDiaChecklist } from "@/lib/data/dieta";
import { categoriasEstudo, formatHoras, sessoesDoDia } from "@/lib/data/estudos";
import { SemanaMontada } from "@/components/checklist/semana-client";
import {
  diaRegistroDoDia,
  historicoDiaRegistros,
  refeicoesParaPlano,
  resumoSemanalRotina,
  rotinaPlanoDoDia,
  rotinaPlanos,
  rotinaTemplates,
  rotinasDoDia,
  rotinasParaPlano,
  semanaMontada,
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
    todasRefeicoes,
    refeicoesCadastradas,
    agua,
    registroHoje,
    historico,
    semanaItens,
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
    refeicoesDoDiaChecklist(user.id, hoje),
    refeicoesParaPlano(user.id),
    aguaDoDiaChecklist(user.id, hoje),
    diaRegistroDoDia(user.id, hoje),
    historicoDiaRegistros(user.id),
    semanaMontada(user.id, hoje),
  ]);

  // Um item pode morar na lista do dia ou no bloco de Hábitos — a diferença é
  // só de vitrine (ver RotinaTemplate.local / Variavel.local). Itens de
  // refeição saem dos dois: eles decidem QUAIS refeições da dieta aparecem, e
  // são renderizados na lista de refeições logo abaixo.
  const ocorrenciasRefeicao = rotinaOcorrencias.filter((oc) => oc.tipo === "refeicao" && oc.mealId);
  const semRefeicao = rotinaOcorrencias.filter((oc) => oc.tipo !== "refeicao");
  const ocorrenciasChecklist = semRefeicao.filter((oc) => oc.local === "checklist");
  const ocorrenciasHabitos = semRefeicao.filter((oc) => oc.local === "habitos");
  const variaveisChecklist = variaveis.filter((v) => v.local === "checklist");
  const variaveisHabitos = variaveis.filter((v) => v.local === "habitos");

  // Refeição com item próprio só entra quando o item cai hoje (respeitando
  // plano e recorrência); as demais continuam aparecendo todo dia, como antes.
  const porMealId = new Map(todasRefeicoes.map((r) => [r.id, r]));
  const comItemProprio = new Set(
    todasRotinas.filter((t) => t.tipo === "refeicao" && t.mealId).map((t) => t.mealId as string)
  );
  const refeicoes = [
    ...ocorrenciasRefeicao.flatMap((oc) => {
      const meal = porMealId.get(oc.mealId as string);
      return meal ? [{ ...meal, horario: oc.horaInicio ?? meal.horario }] : [];
    }),
    ...todasRefeicoes.filter((r) => !comItemProprio.has(r.id)),
  ];

  const itensDoDia = [...ocorrenciasChecklist, ...ocorrenciasHabitos];
  const totalItens = itensDoDia.length + variaveis.length + refeicoes.length + 1;
  const totalFeitos =
    itensDoDia.filter((oc) => oc.feito).length +
    variaveis.filter((v) => v.feito).length +
    refeicoes.filter((r) => r.feito).length +
    (agua.feito ? 1 : 0);
  const pctHoje = totalItens > 0 ? (totalFeitos / totalItens) * 100 : 0;
  const segundosEstudoHoje = sessoesHoje.reduce((s, sessao) => s + sessao.liquidoSec, 0);

  return (
    <div className="stagger flex flex-col gap-6">
      <header className="card-in flex flex-wrap items-end justify-between gap-4 pt-2">
        <div>
          <h1 className="display text-[32px] leading-none text-paper md:text-[38px]">
            Checklist
          </h1>
          <p className="mt-2.5 text-[14px] text-mist first-letter:uppercase">
            {fullDate(hoje)}
          </p>
        </div>
      </header>

      <Tabs defaultValue="hoje">
        <TabsList>
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="hoje">
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
                ocorrencias={ocorrenciasChecklist}
                templates={todasRotinas}
                categorias={categorias}
                rotinasTreino={rotinasTreino}
                sessoesCorrida={sessoesCorrida}
                refeicoesCadastradas={refeicoesCadastradas}
                planos={planos}
                planoAtivoId={planoAtivoId}
                variaveis={variaveisChecklist}
                refeicoes={refeicoes}
                dia={hojeKey}
              />
            </Card>

            <Card className="col-span-12">
              <ChecklistHoje
                habitos={habitos}
                feitos={feitos}
                pctMensal={pctMensalHabitos}
                ocorrencias={ocorrenciasHabitos}
                variaveis={variaveisHabitos}
                templates={todasRotinas}
                categorias={categorias}
                rotinasTreino={rotinasTreino}
                sessoesCorrida={sessoesCorrida}
                refeicoesCadastradas={refeicoesCadastradas}
                planos={planos}
                agua={agua}
                hoje={hojeKey}
              />
            </Card>

            <DiaRegistroCard
              dia={hojeKey}
              pct={pctHoje}
              temItens={totalItens > 0}
              registroExistente={registroHoje?.descricao ?? null}
            />
          </div>
        </TabsContent>

        <TabsContent value="semana">
          <SemanaMontada dias={semanaItens} planos={planos} planoAtivoId={planoAtivoId} />
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardLabel>Histórico de dias</CardLabel>
            <div className="mt-4">
              <HistoricoChecklist registros={historico} />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
