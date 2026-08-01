import Link from "next/link";
import { ArrowUpRight, CalendarX2 } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { Flame } from "@/components/caverna/flame";
import { Donut } from "@/components/caverna/donut";
import { EmptyState } from "@/components/caverna/empty-state";
import { Heatmap } from "@/components/caverna/heatmap";
import { HomeCards } from "@/components/caverna/home-cards";
import { HomePatrimonioChart } from "@/components/caverna/home-patrimonio-chart";
import { eventosDeHoje, streakLC } from "@/lib/data/home";
import { fluxoDeCaixa } from "@/lib/data/financas";
import { evolucaoPatrimonio, resumoCarteira } from "@/lib/data/investimentos";
import {
  calcularHomeCard,
  homeCardConfigs,
  metasParaCatalogo,
  HOME_METRICAS_FIXAS,
} from "@/lib/data/home-metricas";
import { treinosDeHoje } from "@/lib/data/treinos";
import { TreinoHojeCard } from "@/components/treinos/treino-hoje-card";
import { formatBRL, formatBRLCompact } from "@/lib/money";
import { dayKeySP, fmtSP, fullDate, nowSP } from "@/lib/dates";
import { getCurrentUser } from "@/lib/auth";
import { getContaAtiva } from "@/lib/conta-ativa";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const { id: contaFinanceiraId } = await getContaAtiva(user.id);
  const agora = nowSP();

  const [carteira, evolucao, fluxo, eventos, streak, configs, metasCatalogo, treinosHoje] =
    await Promise.all([
      resumoCarteira(contaFinanceiraId, agora),
      evolucaoPatrimonio(contaFinanceiraId, 6, agora),
      fluxoDeCaixa(contaFinanceiraId, 1, agora),
      eventosDeHoje(user.id, agora),
      streakLC(user.id, agora),
      homeCardConfigs(user.id),
      metasParaCatalogo(user.id),
      treinosDeHoje(user.id, agora),
    ]);

  const mesAtual = fluxo[0] ?? { receita: 0, despesa: 0, saldo: 0 };
  const eventosProximos = eventos.slice(0, 3);

  const opcoesMetricas = [...HOME_METRICAS_FIXAS, ...metasCatalogo];
  const cards = await Promise.all(
    configs.map(async (config) => ({
      config,
      data: await calcularHomeCard(user.id, contaFinanceiraId, config, agora),
    }))
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting */}
      <header className="card-in pt-2">
        <h1 className="display text-[32px] leading-none text-paper md:text-[38px]">
          Visão Geral
        </h1>
        <p className="mt-2.5 text-[14px] text-mist">
          Bem-vindo de volta, Lucas. · {fullDate(agora)}
        </p>
      </header>

      {/* 4 cards principais — métrica e período configuráveis por card */}
      <HomeCards cards={cards} opcoes={opcoesMetricas} />

      {/* Treino de hoje — musculação e/ou corrida agendados para o dia */}
      <TreinoHojeCard
        treinos={treinosHoje}
        hoje={dayKeySP(agora)}
        hojeLabel={fmtSP(agora, "EEEE, d 'de' MMMM")}
      />

      {/* Evolução do patrimônio + distribuição dos investimentos */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <div className="flex items-center justify-between">
            <CardLabel>Evolução do patrimônio</CardLabel>
            <Link
              href="/investimentos"
              className="inline-flex items-center gap-1 text-[12.5px] text-mist transition-colors hover:text-mint"
            >
              ver investimentos
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
          </div>
          <div className="mt-4">
            <HomePatrimonioChart data={evolucao} />
          </div>
        </Card>

        <Card className="xl:col-span-5">
          <CardLabel className="mb-4">Distribuição dos investimentos</CardLabel>
          {carteira.porClasse.length === 0 ? (
            <EmptyState
              icon={CalendarX2}
              title="Nenhum ativo cadastrado ainda"
              description="Cadastre seus investimentos para ver a distribuição da carteira."
            />
          ) : (
            <Donut
              segments={carteira.porClasse.map((c) => ({
                label: c.classe,
                value: c.valor,
                cor: c.cor,
              }))}
              size={148}
              strokeWidth={16}
              center={<span className="text-[15px]">{formatBRLCompact(carteira.patrimonio)}</span>}
              centerSub="Total"
              legend
              formatValue={(v) => formatBRL(v)}
            />
          )}
        </Card>
      </div>

      {/* Fluxo de caixa + próximos compromissos + hábitos */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card>
          <CardLabel className="mb-4">Fluxo de caixa</CardLabel>
          <div className="flex flex-col gap-4">
            <BarRow label="Receitas" valor={mesAtual.receita} max={Math.max(mesAtual.receita, mesAtual.despesa, 1)} cor="var(--color-mint)" />
            <BarRow label="Despesas" valor={mesAtual.despesa} max={Math.max(mesAtual.receita, mesAtual.despesa, 1)} cor="var(--color-coral)" />
            <BarRow label="Saldo" valor={mesAtual.saldo} max={Math.max(mesAtual.receita, mesAtual.despesa, 1)} cor="var(--color-ice)" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <CardLabel>Próximos compromissos</CardLabel>
            <Link
              href="/agenda"
              className="inline-flex items-center gap-1 text-[12.5px] text-mist transition-colors hover:text-mint"
            >
              ver agenda
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
          </div>
          {eventosProximos.length === 0 ? (
            <EmptyState
              icon={CalendarX2}
              title="Nada na agenda de hoje"
              description="Dia livre. Se surgir algo, adicione na agenda para não perder de vista."
            />
          ) : (
            <ul className="mt-4 flex flex-col">
              {eventosProximos.map((ev) => (
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
                    {ev.hora ? ev.hora : "dia inteiro"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col">
          <div className="flex items-center justify-between">
            <CardLabel>Hábitos</CardLabel>
            <Link
              href="/treinos"
              className="inline-flex items-center gap-1 text-[12.5px] text-mist transition-colors hover:text-mint"
            >
              ver todos
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <Flame streak={streak.streak} size={56} />
            <div>
              <p className="tabular text-[32px] font-semibold leading-none text-paper">
                {streak.streak}
                <span className="ml-1.5 text-[13px] font-normal text-mist">
                  {streak.streak === 1 ? "dia" : "dias"}
                </span>
              </p>
              <p className="mt-1 text-[12px] text-mist">
                {streak.streak === 0
                  ? "acenda seu foguinho hoje"
                  : "seguidos no mínimo LC"}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[11.5px] text-steel">
            ≥1 treino ou diário de dieta no dia · recorde:{" "}
            <span className="tabular text-mist">
              {Math.max(streak.streak, streak.recordeAnterior)}
            </span>
          </p>
          <div className="mt-auto pt-4">
            <Heatmap
              cells={streak.heatmap}
              cor="62, 224, 143"
              columns={14}
              cellSize={9}
              max={1}
            />
            <p className="mt-2 text-[11px] text-steel">últimas 8 semanas</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function BarRow({
  label,
  valor,
  max,
  cor,
}: {
  label: string;
  valor: number;
  max: number;
  cor: string;
}) {
  const pct = max > 0 ? Math.min(100, (Math.abs(valor) / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-mist">{label}</span>
        <span className="tabular text-ice">{formatBRL(valor)}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: cor }}
        />
      </div>
    </div>
  );
}
