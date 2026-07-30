import { Dumbbell, Flame, Trophy } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { Donut } from "@/components/caverna/donut";
import { EmptyState } from "@/components/caverna/empty-state";
import { Heatmap } from "@/components/caverna/heatmap";
import { PillTabs } from "@/components/caverna/pill-tabs";
import { StatCard } from "@/components/caverna/stat-card";
import { CorridaClient, type CorridaView } from "@/components/treinos/corrida-client";
import { PaceChart, VolumeChart } from "@/components/treinos/corrida-charts";
import { MusculacaoClient, type FichaView } from "@/components/treinos/musculacao-client";
import { PeriodoChartClient } from "@/components/treinos/periodo-chart-client";
import { PlanoCorridaClient } from "@/components/treinos/plano-corrida-client";
import { StravaWidget } from "@/components/treinos/strava-widget";
import { StravaCallbackToast } from "@/components/treinos/strava-callback-toast";
import {
  formatDuracao,
  formatTonelagem,
  frequencia,
  mediaAnual,
  mediaMensal,
  planosCorrida,
  recordes,
  resumoTreinos,
  semanaCicloAtual,
  volumeSemanal,
  weekConfig,
} from "@/lib/data/treinos";
import { dayKeySP, mediumDate, nowSP, shortDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseJSON } from "@/lib/utils";
import { stravaConectado, stravaConfigurado } from "@/lib/strava";

export const dynamic = "force-dynamic";

const tabs = [
  { label: "Visão geral", href: "/treinos", value: "visao" },
  { label: "Musculação", href: "/treinos?tab=musculacao", value: "musculacao" },
  { label: "Corrida", href: "/treinos?tab=corrida", value: "corrida" },
];

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

  return (
    <div className="flex flex-col gap-6">
      <PillTabs tabs={tabs} param="tab" />
      {tab === "visao" && <VisaoGeral userId={user.id} hoje={hoje} />}
      {tab === "musculacao" && <Musculacao userId={user.id} />}
      {tab === "corrida" && <Corrida userId={user.id} hoje={hoje} />}
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
        label="Km na semana"
        value={`${resumo.kmSemana.toLocaleString("pt-BR", {
          maximumFractionDigits: 1,
        })} km`}
        contexto="corridas registradas"
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
            <EmptyState icon={Dumbbell} title="Nenhum treino registrado ainda." />
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

async function Corrida({ userId, hoje }: { userId: string; hoje: Date }) {
  const [corridas, volume, prs, resumo, planosDeCorrida, semanaCorrida, meses, anos, conectado] =
    await Promise.all([
      db.run.findMany({ where: { userId }, orderBy: { data: "desc" }, take: 60 }),
      volumeSemanal(userId, 8, hoje),
      recordes(userId),
      resumoTreinos(userId, hoje),
      planosCorrida(userId, hoje),
      semanaCicloAtual(userId),
      mediaMensal(userId, 6, hoje),
      mediaAnual(userId, 3, hoje),
      stravaConectado(userId),
    ]);

  const configurado = stravaConfigurado();
  // A conexão passa pela rota /api/strava/connect, que gera o state CSRF
  // aleatório e grava o cookie antes de redirecionar para o Strava.
  const authorizeUrl = configurado
    ? "/api/strava/connect?next=" + encodeURIComponent("/treinos?tab=corrida")
    : null;

  const metaKm = await db.setting.findUnique({
    where: { userId_key: { userId, key: "meta_km_mes" } },
  });
  const meta = Number(metaKm?.value ?? 40) || 40;
  const kmMes = corridas
    .filter((c) => dayKeySP(c.data).slice(0, 7) === dayKeySP(hoje).slice(0, 7))
    .reduce((s, c) => s + c.km, 0);
  const pctMeta = meta > 0 ? (kmMes / meta) * 100 : 0;

  const view: CorridaView[] = corridas.map((c) => ({
    id: c.id,
    data: dayKeySP(c.data),
    dataLabel: shortDate(c.data),
    km: c.km,
    segundos: c.segundos,
    tipo: c.tipo,
    sensacao: c.sensacao,
    notas: c.notas,
    stravaLink: c.stravaLink,
  }));

  const pacePontos = [...corridas]
    .reverse()
    .filter((c) => c.km > 0)
    .map((c) => ({ label: shortDate(c.data), pace: c.segundos / c.km }));

  return (
    <div className="stagger grid grid-cols-12 gap-6">
      <StravaCallbackToast />
      <Card className="col-span-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardLabel>Corrida</CardLabel>
          <StravaWidget
            configurado={configurado}
            conectado={conectado}
            authorizeUrl={authorizeUrl}
          />
        </div>
        <div className="mt-4">
          <PlanoCorridaClient planos={planosDeCorrida} semana={semanaCorrida} />
        </div>
      </Card>

      <Card destaque={pctMeta >= 100} className="col-span-12 lg:col-span-4">
        <CardLabel>Km no mês</CardLabel>
        <div className="mt-5">
          <Donut
            pct={pctMeta}
            center={`${kmMes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}`}
            centerSub={`de ${meta} km`}
            cor={pctMeta >= 100 ? "var(--color-mint)" : "var(--color-steel)"}
          />
        </div>
        <p className="mt-4 text-[13px] text-mist">
          {pctMeta >= 100
            ? "Meta de quilometragem batida no mês."
            : `Faltam ${(meta - kmMes).toLocaleString("pt-BR", {
                maximumFractionDigits: 1,
              })} km para a meta.`}
        </p>
      </Card>

      <Card className="col-span-12 lg:col-span-8">
        <CardLabel>Volume semanal · 8 semanas</CardLabel>
        <div className="mt-5">
          <VolumeChart data={volume} />
        </div>
      </Card>

      <Card className="col-span-12">
        <PeriodoChartClient meses={meses} anos={anos} />
      </Card>

      <Card className="col-span-12 lg:col-span-7">
        <CardLabel>Evolução do pace</CardLabel>
        <div className="mt-5">
          {pacePontos.length < 2 ? (
            <EmptyState
              icon={Trophy}
              title="Registre ao menos duas corridas para ver a evolução."
            />
          ) : (
            <PaceChart data={pacePontos} />
          )}
        </div>
      </Card>

      <Card className="col-span-12 lg:col-span-5">
        <CardLabel>Recordes</CardLabel>
        <div className="mt-4 flex flex-col gap-3">
          {[prs.cinco, prs.dez].map((pr, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-[14px] border border-stroke bg-surface-2 px-4 py-3"
            >
              <Trophy className="h-4 w-4 text-amber" strokeWidth={1.5} />
              <div className="flex-1">
                <p className="text-[13px] text-ice">{i === 0 ? "5 km" : "10 km"}</p>
                <p className="text-[11.5px] text-steel">
                  {pr ? `projetado de ${mediumDate(pr.data)}` : "sem corrida na distância"}
                </p>
              </div>
              <span className="tabular text-[14px] text-paper">
                {pr ? formatDuracao(pr.tempo) : "—"}
              </span>
            </div>
          ))}
          <p className="mt-1 text-[11.5px] text-steel">
            Km na semana:{" "}
            <span className="tabular text-mist">
              {resumo.kmSemana.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km
            </span>
          </p>
        </div>
      </Card>

      <Card className="col-span-12">
        <CorridaClient corridas={view} hoje={dayKeySP(hoje)} />
      </Card>
    </div>
  );
}
