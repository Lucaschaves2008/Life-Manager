import { Card, CardLabel } from "@/components/caverna/card";
import { Donut } from "@/components/caverna/donut";
import { PillTabs } from "@/components/caverna/pill-tabs";
import { StatCard } from "@/components/caverna/stat-card";
import {
  AlimentosClient,
  type AlimentoView,
} from "@/components/dieta/alimentos-client";
import {
  AguaClient,
  ExtrasClient,
  NotasClient,
  RefeicoesClient,
} from "@/components/dieta/hoje-client";
import { MacroBars } from "@/components/dieta/macro-bars";
import { PlanoClient, type DietaView } from "@/components/dieta/plano-client";
import {
  PesoChart,
  PesoClient,
  type RegistroPeso,
} from "@/components/dieta/peso-client";
import {
  aderencia7d,
  diaDaDieta,
  evolucaoPeso,
  macrosDaRefeicao,
  macrosZero,
  somaMacros,
  streakDieta,
} from "@/lib/data/dieta";
import { mediaKcal7d } from "@/lib/data/home";
import { dayKeySP, mediumDate, nowSP } from "@/lib/dates";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const tabs = [
  { label: "Hoje", href: "/dieta", value: "hoje" },
  { label: "Plano alimentar", href: "/dieta?tab=plano", value: "plano" },
  { label: "Alimentos", href: "/dieta?tab=alimentos", value: "alimentos" },
  { label: "Métricas", href: "/dieta?tab=metricas", value: "metricas" },
];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; novo?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab = tabParam ?? "hoje";
  const hoje = nowSP();

  return (
    <div className="flex flex-col gap-6">
      <PillTabs tabs={tabs} param="tab" />
      {tab === "hoje" && <Hoje hoje={hoje} />}
      {tab === "plano" && <Plano />}
      {tab === "alimentos" && <Alimentos />}
      {tab === "metricas" && <Metricas hoje={hoje} />}
    </div>
  );
}

async function Hoje({ hoje }: { hoje: Date }) {
  const [dia, aderencia, streak, media7] = await Promise.all([
    diaDaDieta(hoje),
    aderencia7d(hoje),
    streakDieta(hoje),
    mediaKcal7d(hoje),
  ]);

  const pctKcal =
    dia.metas.kcal > 0 ? (dia.consumido.kcal / dia.metas.kcal) * 100 : 0;
  const dentroDaMeta = pctKcal > 0 && pctKcal <= 100;

  return (
    <div className="stagger grid grid-cols-12 gap-6">
      <Card destaque={dentroDaMeta} className="col-span-12 lg:col-span-4">
        <CardLabel>Calorias de hoje</CardLabel>
        <div className="mt-5">
          <Donut
            pct={pctKcal}
            center={Math.round(dia.consumido.kcal).toLocaleString("pt-BR")}
            centerSub={`de ${dia.metas.kcal.toLocaleString("pt-BR")} kcal`}
            cor={pctKcal > 115 ? "var(--color-coral)" : "var(--color-mint)"}
            size={164}
          />
        </div>
        <p className="mt-4 text-[13px] text-mist">
          {dia.dietaNome
            ? `Plano ativo: ${dia.dietaNome}.`
            : "Nenhuma dieta ativa — ative um plano alimentar."}
        </p>
      </Card>

      <Card className="col-span-12 lg:col-span-4">
        <CardLabel>Macros</CardLabel>
        <div className="mt-5">
          <MacroBars consumido={dia.consumido} metas={dia.metas} />
        </div>
      </Card>

      <Card className="col-span-12 lg:col-span-4">
        <CardLabel>Água</CardLabel>
        <div className="mt-5">
          <AguaClient dia={dia} />
        </div>
      </Card>

      <StatCard
        className="col-span-6 lg:col-span-4"
        label="Aderência · 7 dias"
        value={`${Math.round(aderencia)}%`}
        contexto="refeições cumpridas"
      />
      <StatCard
        className="col-span-6 lg:col-span-4"
        label="Média de kcal · 7 dias"
        value={Math.round(media7).toLocaleString("pt-BR")}
        contexto={`meta de ${dia.metas.kcal.toLocaleString("pt-BR")} kcal`}
      />
      <StatCard
        className="col-span-12 lg:col-span-4"
        label="Streak no plano"
        value={`${streak} ${streak === 1 ? "dia" : "dias"}`}
        contexto="diário preenchido"
      />

      <Card className="col-span-12 lg:col-span-7">
        <CardLabel>Refeições do dia</CardLabel>
        <div className="mt-4">
          <RefeicoesClient dia={dia} />
        </div>
      </Card>

      <div className="col-span-12 flex flex-col gap-6 lg:col-span-5">
        <Card>
          <CardLabel>Extras</CardLabel>
          <div className="mt-4">
            <ExtrasClient dia={dia} />
          </div>
        </Card>
        <Card>
          <CardLabel>Notas do dia</CardLabel>
          <div className="mt-4">
            <NotasClient dia={dia} />
          </div>
        </Card>
      </div>
    </div>
  );
}

async function Plano() {
  const [dietas, alimentos] = await Promise.all([
    db.diet.findMany({
      orderBy: { nome: "asc" },
      include: {
        meals: {
          orderBy: { ordem: "asc" },
          include: { items: { include: { food: true } } },
        },
      },
    }),
    db.food.findMany({ orderBy: { nome: "asc" } }),
  ]);

  const view: DietaView[] = dietas.map((d) => {
    const refeicoes = d.meals.map((m) => ({
      id: m.id,
      nome: m.nome,
      horario: m.horario,
      macros: macrosDaRefeicao(m.items),
      itens: m.items.map((i) => ({
        id: i.id,
        nome: i.food.nome,
        quantidade: i.quantidade,
        unidade: i.unidade,
      })),
    }));
    return {
      id: d.id,
      nome: d.nome,
      ativa: d.ativa,
      metas: {
        kcal: d.metaKcal,
        prot: d.metaProt,
        carb: d.metaCarb,
        gord: d.metaGord,
      },
      totais: refeicoes.map((r) => r.macros).reduce(somaMacros, macrosZero),
      refeicoes,
    };
  });

  return (
    <PlanoClient
      dietas={view}
      alimentos={alimentos.map((a) => ({
        id: a.id,
        nome: a.nome,
        porcaoNome: a.porcaoNome,
      }))}
    />
  );
}

async function Alimentos() {
  const alimentos = await db.food.findMany({
    orderBy: { nome: "asc" },
    include: { _count: { select: { mealItems: true } } },
  });

  const view: AlimentoView[] = alimentos.map((a) => ({
    id: a.id,
    nome: a.nome,
    kcal100: a.kcal100,
    prot100: a.prot100,
    carb100: a.carb100,
    gord100: a.gord100,
    porcaoNome: a.porcaoNome,
    porcaoG: a.porcaoG,
    usadoEmRefeicoes: a._count.mealItems,
  }));

  return (
    <Card>
      <CardLabel>Biblioteca de alimentos</CardLabel>
      <p className="mt-2 text-[13px] text-mist">
        Valores por 100 g. A porção é opcional e serve para contar por unidade.
      </p>
      <div className="mt-5">
        <AlimentosClient alimentos={view} />
      </div>
    </Card>
  );
}

async function Metricas({ hoje }: { hoje: Date }) {
  const [{ pontos, atual, variacao30d, alvo }, registros] = await Promise.all([
    evolucaoPeso(hoje),
    db.weightLog.findMany({ orderBy: { data: "desc" }, take: 40 }),
  ]);

  const view: RegistroPeso[] = registros.map((r) => ({
    id: r.id,
    data: dayKeySP(r.data),
    dataLabel: mediumDate(r.data),
    pesoKg: r.pesoKg,
    cintura: r.cintura,
    braco: r.braco,
  }));

  const distancia = atual != null ? atual - alvo : null;

  return (
    <div className="stagger grid grid-cols-12 gap-6">
      <StatCard
        className="col-span-6 lg:col-span-4"
        label="Peso atual"
        value={
          atual != null
            ? `${atual.toLocaleString("pt-BR", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })} kg`
            : "—"
        }
        contexto="último registro"
      />
      <StatCard
        className="col-span-6 lg:col-span-4"
        label="Variação · 30 dias"
        value={
          variacao30d != null
            ? `${variacao30d > 0 ? "+" : ""}${variacao30d.toLocaleString("pt-BR", {
                maximumFractionDigits: 1,
              })}%`
            : "—"
        }
        pct={variacao30d}
        upIsBad
        contexto="contra 30 dias atrás"
      />
      <StatCard
        className="col-span-12 lg:col-span-4"
        label="Distância da meta"
        value={
          distancia != null
            ? `${distancia > 0 ? "+" : ""}${distancia.toLocaleString("pt-BR", {
                maximumFractionDigits: 1,
              })} kg`
            : "—"
        }
        contexto={`alvo de ${alvo} kg`}
      />

      <Card className="col-span-12">
        <CardLabel>Evolução do peso</CardLabel>
        <div className="mt-5">
          <PesoChart pontos={pontos} />
        </div>
      </Card>

      <Card className="col-span-12">
        <PesoClient registros={view} hoje={dayKeySP(hoje)} />
      </Card>
    </div>
  );
}
