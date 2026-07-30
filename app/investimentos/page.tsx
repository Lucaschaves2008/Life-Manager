import { PieChart } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { Donut } from "@/components/caverna/donut";
import { EmptyState } from "@/components/caverna/empty-state";
import { HeroMoney } from "@/components/caverna/hero-money";
import { StatCard } from "@/components/caverna/stat-card";
import { VariationBadge } from "@/components/caverna/variation-badge";
import {
  AtivosClient,
  type AtivoView,
} from "@/components/investimentos/ativos-client";
import { CalculadoraClient } from "@/components/investimentos/calculadora-client";
import { EvolucaoClient } from "@/components/investimentos/evolucao-client";
import {
  aportesDevidos,
  ativosResumidos,
  evolucaoPatrimonio,
  resumoCarteira,
} from "@/lib/data/investimentos";
import { dayKeySP, mediumDate, monthName, nowSP, toSP } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { getCurrentUser } from "@/lib/auth";
import { getContaAtiva } from "@/lib/conta-ativa";
import { ContaFinanceiraSelector } from "@/components/shell/conta-financeira-selector";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getCurrentUser();
  const { id: contaFinanceiraId, contas } = await getContaAtiva(user.id);
  const hoje = nowSP();
  const [resumo, ativos, devidos, seis, doze, tudo] = await Promise.all([
    resumoCarteira(contaFinanceiraId, hoje),
    ativosResumidos(contaFinanceiraId, hoje),
    aportesDevidos(contaFinanceiraId, 7, hoje),
    evolucaoPatrimonio(contaFinanceiraId, 6, hoje),
    evolucaoPatrimonio(contaFinanceiraId, 12, hoje),
    evolucaoPatrimonio(contaFinanceiraId, 24, hoje),
  ]);

  const view: AtivoView[] = ativos.map((a) => ({
    id: a.id,
    nome: a.nome,
    classe: a.classe,
    instituicao: a.instituicao,
    cor: a.cor,
    diaAporte: a.diaAporte,
    revisarACada: a.revisarACada,
    valorAtual: a.valorAtual,
    aportado: a.aportado,
    rendimento: a.rendimento,
    pctRendimento: a.pctRendimento,
    serie: a.serie,
    movimentos: a.movimentos.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      valor: m.valor,
      dataLabel: mediumDate(m.data),
      dataISO: dayKeySP(m.data),
      nota: m.nota,
      assetId: a.id,
    })),
  }));

  const mesRef = monthName(toSP(hoje));

  return (
    <div className="stagger grid grid-cols-12 gap-6">
      <div className="col-span-12 flex justify-end">
        <ContaFinanceiraSelector contas={contas} ativaId={contaFinanceiraId} />
      </div>

      <Card className="col-span-12 lg:col-span-5">
        <CardLabel>Patrimônio total</CardLabel>
        <div className="mt-3">
          <HeroMoney centavos={resumo.patrimonio} size="xl" ticker />
        </div>
        <p className="mt-3 text-[13px] text-mist">
          {ativos.length} {ativos.length === 1 ? "ativo" : "ativos"} em{" "}
          {resumo.porClasse.length}{" "}
          {resumo.porClasse.length === 1 ? "classe" : "classes"}
        </p>
      </Card>

      <StatCard
        className="col-span-6 lg:col-span-3"
        label="Total aportado"
        value={formatBRL(resumo.aportado)}
        contexto="dinheiro do seu bolso"
      />

      <StatCard
        className="col-span-6 lg:col-span-4"
        label="Rendimento acumulado"
        value={formatBRL(resumo.rendimento)}
        pct={resumo.pctRendimento}
        contexto="desde o primeiro aporte"
      />

      <Card destaque className="col-span-12 lg:col-span-4">
        <CardLabel>Rendimento de {mesRef}</CardLabel>
        <div className="mt-3 flex items-baseline gap-3">
          <HeroMoney centavos={resumo.rendimentoMes} />
          {resumo.pctRendimentoMes != null && (
            <VariationBadge pct={resumo.pctRendimentoMes} />
          )}
        </div>
        <p className="mt-3 text-[13px] text-mist">
          {resumo.rendimentoMes >= 0
            ? "É o que a carteira rendeu sozinha no mês, sem contar aportes."
            : "A carteira recuou no mês, descontados aportes e resgates."}
        </p>
      </Card>

      <Card className="col-span-12 lg:col-span-8">
        <EvolucaoClient series={{ mes: seis, ano: doze, total: tudo }} />
      </Card>

      <Card className="col-span-12 lg:col-span-4">
        <CardLabel>Alocação por classe</CardLabel>
        <div className="mt-5">
          {resumo.porClasse.length === 0 ? (
            <EmptyState icon={PieChart} title="Cadastre um ativo para ver a alocação." />
          ) : (
            <Donut
              segments={resumo.porClasse.map((c) => ({
                label: c.classe,
                value: c.valor,
                cor: c.cor,
              }))}
              legend
              formatValue={(v) => formatBRL(v)}
              center={formatBRL(resumo.patrimonio).replace(/,\d{2}$/, "")}
              centerSub="total"
              size={132}
            />
          )}
        </div>
      </Card>

      <Card className="col-span-12 lg:col-span-8">
        <CardLabel>Ativos</CardLabel>
        <div className="mt-4">
          <AtivosClient ativos={view} hoje={dayKeySP(hoje)} />
        </div>
      </Card>

      {devidos.length > 0 && (
        <Card className="col-span-12">
          <CardLabel>Aportes desta semana</CardLabel>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {devidos.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2.5 rounded-full border border-stroke bg-surface-2 py-1.5 pl-2.5 pr-3.5"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: d.cor }}
                />
                <span className="text-[13px] text-ice">{d.nome}</span>
                <span className="text-[12px] text-steel">
                  {d.instituicao} · dia {d.diaAporte}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="col-span-12">
        <CalculadoraClient />
      </Card>
    </div>
  );
}
