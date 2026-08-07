import { Dumbbell, Flame, Trophy } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { Donut } from "@/components/caverna/donut";
import { EmptyState } from "@/components/caverna/empty-state";
import { Heatmap } from "@/components/caverna/heatmap";
import { PillTabs } from "@/components/caverna/pill-tabs";
import { StatCard } from "@/components/caverna/stat-card";
import { CardioClient, type CorridaView } from "@/components/treinos/cardio-client";
import { PaceChart, VolumeChart } from "@/components/treinos/cardio-charts";
import { MusculacaoClient, type FichaView } from "@/components/treinos/musculacao-client";
import { PeriodoChartClient } from "@/components/treinos/periodo-chart-client";
import { PlanoCardioClient } from "@/components/treinos/plano-cardio-client";
import { StravaWidget } from "@/components/treinos/strava-widget";
import { StravaCallbackToast } from "@/components/treinos/strava-callback-toast";
import {
  MODALIDADE,
  MODALIDADES_CARDIO,
  formatDistanciaMod,
  formatDuracao,
  formatTonelagem,
  frequencia,
  mediaAnual,
  mediaMensal,
  metaDistanciaMes,
  planosCorrida,
  recordes,
  resumoTreinos,
  semanaCicloAtual,
  volumeSemanal,
  weekConfig,
  type ModalidadeCardio,
} from "@/lib/data/treinos";
import { ritmoBruto } from "@/lib/data/treinos-format";
import { dayKeySP, mediumDate, nowSP, shortDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseJSON } from "@/lib/utils";
import { stravaConectado, stravaConfigurado } from "@/lib/strava";

export const dynamic = "force-dynamic";

// Cada modalidade de cardio ganha a MESMA aba, montada pelo mesmo componente
// (Cardio) — só o parâmetro muda. Adicionar uma quarta modalidade é adicionar
// uma entrada em MODALIDADE e nada mais aqui.
const tabs = [
  { label: "Visão geral", href: "/treinos", value: "visao" },
  { label: "Musculação", href: "/treinos?tab=musculacao", value: "musculacao" },
  ...MODALIDADES_CARDIO.map((m) => ({
    label: MODALIDADE[m].label,
    href: `/treinos?tab=${m}`,
    value: m as string,
  })),
];

function modalidadeDaTab(tab: string): ModalidadeCardio | null {
  return MODALIDADES_CARDIO.includes(tab as ModalidadeCardio)
    ? (tab as ModalidadeCardio)
    : null;
}

const coresGrupo = [
  "var(--color-mint)",
  "var(--cal-blue)",
  "var(--cal-amber)",
  "var(--cal-teal)",
  "var(--cal-lilac)",
  "var(--color-steel)",
  "var(--color-navy)",
  "var(--cal-coral)",
];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; novo?: string }>;
}) {
  const user = await getCurrentUser();
  const { tab: tabParam, novo } = await searchParams;
  // "+ Novo → Treino" cai direto na musculação, onde a execução acontece
  const tab = novo === "1" ? tabParam ?? "musculacao" : tabParam ?? "visao";
  const hoje = nowSP();
  const modalidade = modalidadeDaTab(tab);

  return (
    <div className="flex flex-col gap-6">
      <PillTabs tabs={tabs} param="tab" />
      {tab === "visao" && <VisaoGeral userId={user.id} hoje={hoje} />}
      {tab === "musculacao" && <Musculacao userId={user.id} />}
      {modalidade && <Cardio userId={user.id} hoje={hoje} modalidade={modalidade} />}
    </div>
  );
}

async function VisaoGeral({ userId, hoje }: { userId: string; hoje: Date }) {
  const [resumo, cells, sessoes] = await Promise.all([
    resumoTreinos(userId, hoje),
    frequencia(userId, 118, hoje),
    db.workoutSession.findMany({
      where: { userId },
      orderBy: { data: "desc" },
      take: 6,
      include: { routine: true, setLogs: true },
    }),
  ]);

  const acimaDaMeta = resumo.pctMeta >= 100;
  const sessoesCardio = MODALIDADES_CARDIO.reduce(
    (s, m) => s + resumo.porModalidade[m].sessoes,
    0
  );

  return (
    <div className="stagger grid grid-cols-12 gap-6">
      <Card className="col-span-12 lg:col-span-8">
        <CardLabel>Frequência · últimos 4 meses</CardLabel>
        <div className="mt-5 overflow-x-auto">
          <Heatmap cells={cells} cor="13, 110, 253" columns={17} max={2} />
        </div>
        <p className="mt-4 text-[12.5px] text-steel">
          Cada quadrado é um dia; a intensidade cresce com o número de treinos.
        </p>
      </Card>

      <Card destaque={acimaDaMeta} className="col-span-12 lg:col-span-4">
        <CardLabel>Meta do mês</CardLabel>
        <div className="mt-5">
          <Donut
            pct={resumo.pctMeta}
            center={`${Math.round(resumo.pctMeta)}%`}
            centerSub={`${resumo.treinosMes} de ${resumo.metaMes}`}
            cor={acimaDaMeta ? "var(--color-mint)" : "var(--color-steel)"}
          />
        </div>
        <p className="mt-4 text-[13px] text-mist">
          {acimaDaMeta
            ? "Meta batida — o resto do mês é lucro."
            : `Faltam ${resumo.metaMes - resumo.treinosMes} treinos para bater a meta.`}
        </p>
      </Card>

      <StatCard
        className="col-span-6 lg:col-span-3"
        label="Streak"
        value={`${resumo.streak} ${resumo.streak === 1 ? "dia" : "dias"}`}
        contexto="dias seguidos treinando"
        extra={<Flame className="h-4 w-4 text-mint" strokeWidth={1.5} />}
      />
      <StatCard
        className="col-span-6 lg:col-span-3"
        label="Tonelagem da semana"
        value={formatTonelagem(resumo.tonelagemSemana)}
        contexto="reps × carga"
      />
      <StatCard
        className="col-span-6 lg:col-span-3"
        label="Cardio na semana"
        value={`${sessoesCardio} ${sessoesCardio === 1 ? "sessão" : "sessões"}`}
        contexto={
          // só as modalidades com volume na semana — três zeros não dizem nada
          MODALIDADES_CARDIO.filter((m) => resumo.porModalidade[m].km > 0)
            .map((m) => formatDistanciaMod(resumo.porModalidade[m].km, m))
            .join(" · ") || "corrida, natação e ciclismo"
        }
      />
      <StatCard
        className="col-span-6 lg:col-span-3"
        label="Treinos no mês"
        value={String(resumo.treinosMes)}
        contexto={`meta de ${resumo.metaMes}`}
      />

      <Card className="col-span-12 lg:col-span-5">
        <CardLabel>Volume por grupo muscular</CardLabel>
        <div className="mt-5">
          {resumo.porGrupo.length === 0 ? (
            <EmptyState icon={Dumbbell} title="Nenhuma série registrada neste mês." />
          ) : (
            <Donut
              segments={resumo.porGrupo.map((g, i) => ({
                label: g.grupo,
                value: g.series,
                cor: coresGrupo[i % coresGrupo.length],
              }))}
              legend
              formatValue={(v) => `${v} séries`}
              center={String(resumo.porGrupo.reduce((s, g) => s + g.series, 0))}
              centerSub="séries"
              size={132}
            />
          )}
        </div>
      </Card>

      <Card className="col-span-12 lg:col-span-7">
        <CardLabel>Sessões recentes</CardLabel>
        <div className="mt-4 flex flex-col">
          {sessoes.length === 0 ? (
            <EmptyState
              icon={Dumbbell}
              title="Nenhum treino registrado ainda"
              description="Execute uma ficha para ver aqui suas sessões, séries e tonelagem."
            />
          ) : (
            sessoes.map((s) => {
              const tonelagem = s.setLogs.reduce(
                (t, log) => t + log.reps * log.cargaKg,
                0
              );
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 border-b border-stroke py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] text-ice">
                      {s.routine?.nome ?? "Treino avulso"}
                    </p>
                    <p className="tabular text-[11.5px] text-steel">
                      {mediumDate(s.data)} · {s.duracaoMin} min
                    </p>
                  </div>
                  <span className="tabular text-[13px] text-mist">
                    {formatTonelagem(tonelagem)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}

async function Musculacao({ userId }: { userId: string }) {
  const [rotinas, semana] = await Promise.all([
    db.routine.findMany({
      where: { userId },
      orderBy: { ordem: "asc" },
      include: {
        exercises: {
          orderBy: { ordem: "asc" },
          include: { weeks: { orderBy: { semana: "asc" } } },
        },
      },
    }),
    semanaCicloAtual(userId),
  ]);

  const fichas: FichaView[] = rotinas.map((r) => ({
    id: r.id,
    nome: r.nome,
    foco: r.foco,
    dias: parseJSON<string[]>(r.diasSemana, []).map(Number),
    exercicios: r.exercises.map((e) => {
      const cfg = weekConfig(
        { series: e.series, repsAlvo: e.repsAlvo, cargaAtual: e.cargaAtual },
        e.weeks,
        semana
      );
      return {
        id: e.id,
        nome: e.nome,
        grupoMuscular: e.grupoMuscular,
        metodo: e.metodo,
        tipoAlvo: e.tipoAlvo,
        series: cfg.series,
        repsAlvo: cfg.repsAlvo,
        cargaAtual: cfg.cargaAtual,
        tempoAlvoSeg: e.tempoAlvoSeg,
        descansoSeg: e.descansoSeg,
        observacao: e.observacao,
        herdado: cfg.herdado,
        origem: cfg.origem,
      };
    }),
  }));

  return <MusculacaoClient fichas={fichas} semana={semana} />;
}

/**
 * Aba de uma modalidade de cardio. É a MESMA tela para corrida, natação e
 * ciclismo — plano com periodização, meta do mês, volume, ritmo, recordes e
 * histórico —, parametrizada por `modalidade`.
 */
async function Cardio({
  userId,
  hoje,
  modalidade,
}: {
  userId: string;
  hoje: Date;
  modalidade: ModalidadeCardio;
}) {
  const cfg = MODALIDADE[modalidade];
  const [sessoes, volume, prs, resumo, planos, semanaCiclo, meses, anos, conectado, metaMes] =
    await Promise.all([
      db.run.findMany({
        where: { userId, modalidade },
        orderBy: { data: "desc" },
        take: 60,
      }),
      volumeSemanal(userId, 8, hoje, modalidade),
      recordes(userId, modalidade),
      resumoTreinos(userId, hoje),
      planosCorrida(userId, hoje, modalidade),
      semanaCicloAtual(userId),
      mediaMensal(userId, 6, hoje, modalidade),
      mediaAnual(userId, 3, hoje, modalidade),
      stravaConectado(userId),
      metaDistanciaMes(userId, modalidade, hoje),
    ]);

  // Natação não passa pelo Strava (piscina não tem GPS e a distância não vem
  // confiável) — o widget de conexão só aparece onde a importação funciona.
  const temStrava = modalidade !== "natacao";
  const configurado = stravaConfigurado();
  // A conexão passa pela rota /api/strava/connect, que gera o state CSRF
  // aleatório e grava o cookie antes de redirecionar para o Strava.
  const authorizeUrl = configurado
    ? "/api/strava/connect?next=" + encodeURIComponent(`/treinos?tab=${modalidade}`)
    : null;

  const batida = metaMes.pct >= 100;
  const faltam = Math.max(0, metaMes.meta - metaMes.feito);
  const casasMeta = cfg.unidade === "m" ? 0 : 1;
  const formatarMeta = (v: number) =>
    v.toLocaleString("pt-BR", { maximumFractionDigits: casasMeta });

  const view: CorridaView[] = sessoes.map((c) => ({
    id: c.id,
    data: dayKeySP(c.data),
    dataLabel: shortDate(c.data),
    km: c.km,
    segundos: c.segundos,
    tipo: c.tipo,
    sensacao: c.sensacao,
    notas: c.notas,
    stravaLink: c.stravaLink,
    quantificar: c.quantificar,
    runSessionId: c.runSessionId,
  }));

  const ritmoPontos = [...sessoes]
    .reverse()
    .filter((c) => c.km > 0)
    .map((c) => ({
      label: shortDate(c.data),
      pace: ritmoBruto(c.segundos, c.km, modalidade),
    }));

  return (
    <div className="stagger grid grid-cols-12 gap-6">
      {temStrava && <StravaCallbackToast />}
      <Card className="col-span-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardLabel>{cfg.label}</CardLabel>
          {temStrava && (
            <StravaWidget
              configurado={configurado}
              conectado={conectado}
              authorizeUrl={authorizeUrl}
            />
          )}
        </div>
        <div className="mt-4">
          <PlanoCardioClient planos={planos} semana={semanaCiclo} modalidade={modalidade} />
        </div>
      </Card>

      <Card destaque={batida} className="col-span-12 lg:col-span-4">
        <CardLabel>{cfg.unidade === "m" ? "Metros" : "Km"} no mês</CardLabel>
        <div className="mt-5">
          <Donut
            pct={metaMes.pct}
            center={formatarMeta(metaMes.feito)}
            centerSub={`de ${formatarMeta(metaMes.meta)} ${cfg.unidade}`}
            cor={batida ? "var(--color-mint)" : "var(--color-steel)"}
          />
        </div>
        <p className="mt-4 text-[13px] text-mist">
          {batida
            ? "Meta de distância batida no mês."
            : `Faltam ${formatarMeta(faltam)} ${cfg.unidade} para a meta.`}
        </p>
      </Card>

      <Card className="col-span-12 lg:col-span-8">
        <CardLabel>Volume semanal · 8 semanas</CardLabel>
        <div className="mt-5">
          <VolumeChart data={volume} modalidade={modalidade} />
        </div>
      </Card>

      <Card className="col-span-12">
        <PeriodoChartClient meses={meses} anos={anos} modalidade={modalidade} />
      </Card>

      <Card className="col-span-12 lg:col-span-7">
        <CardLabel>Evolução — {cfg.ritmoLabel.toLowerCase()}</CardLabel>
        <div className="mt-5">
          {ritmoPontos.length < 2 ? (
            <EmptyState
              icon={Trophy}
              title={`Registre ao menos duas sessões de ${cfg.label.toLowerCase()} para ver a evolução.`}
            />
          ) : (
            <PaceChart data={ritmoPontos} modalidade={modalidade} />
          )}
        </div>
      </Card>

      <Card className="col-span-12 lg:col-span-5">
        <CardLabel>Recordes</CardLabel>
        <div className="mt-4 flex flex-col gap-3">
          {[prs.curta, prs.longa].map((pr, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-[14px] border border-stroke bg-surface-2 px-4 py-3"
            >
              <Trophy className="h-4 w-4 text-amber" strokeWidth={1.5} />
              <div className="flex-1">
                <p className="text-[13px] text-ice">
                  {cfg.recordes[i].toLocaleString("pt-BR")} {cfg.unidade}
                </p>
                <p className="text-[11.5px] text-steel">
                  {pr
                    ? `projetado de ${mediumDate(pr.data)}`
                    : `sem ${cfg.atividade} na distância`}
                </p>
              </div>
              <span className="tabular text-[14px] text-paper">
                {pr ? formatDuracao(pr.tempo) : "—"}
              </span>
            </div>
          ))}
          <p className="mt-1 text-[11.5px] text-steel">
            Distância na semana:{" "}
            <span className="tabular text-mist">
              {formatDistanciaMod(resumo.porModalidade[modalidade].km, modalidade)}
            </span>
          </p>
        </div>
      </Card>

      <Card className="col-span-12">
        <CardioClient corridas={view} hoje={dayKeySP(hoje)} modalidade={modalidade} planos={planos} />
      </Card>
    </div>
  );
}
