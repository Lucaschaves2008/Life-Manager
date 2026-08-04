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
import { ReceitasClient } from "@/components/dieta/receitas-client";
import {
  PesoChart,
  PesoClient,
  type RegistroPeso,
} from "@/components/dieta/peso-client";
import { LembretePesoCard } from "@/components/dieta/lembrete-peso-client";
import {
  aderencia7d,
  bibliotecaDeReceitas,
  diaDaDieta,
  evolucaoPeso,
  macrosZero,
  opcaoView,
  receitaInclude,
  somaMacros,
  streakDieta,
} from "@/lib/data/dieta";
import { mediaKcal7d } from "@/lib/data/home";
import { dayKeySP, mediumDate, nowSP } from "@/lib/dates";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const tabs = [
  { label: "Hoje", href: "/dieta", value: "hoje" },
  { label: "Plano alimentar", href: "/dieta?tab=plano", value: "plano" },
  { label: "Refeições", href: "/dieta?tab=refeicoes", value: "refeicoes" },
  { label: "Alimentos", href: "/dieta?tab=alimentos", value: "alimentos" },
  { label: "Métricas", href: "/dieta?tab=metricas", value: "metricas" },
];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; novo?: string }>;
}) {
  const user = await getCurrentUser();
  const { tab: tabParam } = await searchParams;
  const tab = tabParam ?? "hoje";
  const hoje = nowSP();

  return (
    <div className="flex flex-col gap-6">
      <PillTabs tabs={tabs} param="tab" />
      {tab === "hoje" && <Hoje userId={user.id} hoje={hoje} />}
      {tab === "plano" && <Plano userId={user.id} />}
      {tab === "refeicoes" && <Refeicoes userId={user.id} />}
      {tab === "alimentos" && <Alimentos userId={user.id} />}
      {tab === "metricas" && <Metricas userId={user.id} hoje={hoje} />}
    </div>
  );
}

async function Hoje({ userId, hoje }: { userId: string; hoje: Date }) {
  const [dia, aderencia, streak, media7] = await Promise.all([
    diaDaDieta(userId, hoje),
    aderencia7d(userId, hoje),
    streakDieta(userId, hoje),
    mediaKcal7d(userId, hoje),
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

async function Plano({ userId }: { userId: string }) {
  const [dietas, receitas, alimentos] = await Promise.all([
    db.diet.findMany({
      where: { userId },
      orderBy: { nome: "asc" },
      include: {
        meals: {
          orderBy: { ordem: "asc" },
          include: {
            options: {
              orderBy: { ordem: "asc" },
              include: { recipe: { include: receitaInclude } },
            },
          },
        },
      },
    }),
    bibliotecaDeReceitas(userId),
    db.food.findMany({ where: { userId }, orderBy: { nome: "asc" } }),
  ]);

  const view: DietaView[] = dietas.map((d) => {
    const refeicoes = d.meals.map((m) => {
      const opcoes = m.options.map(opcaoView);
      // preview do horário = 1ª opção (referência do plano montado)
      return {
        id: m.id,
        nome: m.nome,
        horario: m.horario,
        macros: opcoes[0]?.macros ?? macrosZero,
        opcoes,
      };
    });
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

  return <PlanoClient dietas={view} receitas={receitas} alimentos={alimentos} />;
}

async function Refeicoes({ userId }: { userId: string }) {
  const [receitas, alimentos] = await Promise.all([
    bibliotecaDeReceitas(userId),
    db.food.findMany({ where: { userId }, orderBy: { nome: "asc" } }),
  ]);

  return <ReceitasClient receitas={receitas} alimentos={alimentos} />;
}

async function Alimentos({ userId }: { userId: string }) {
  const alimentos = await db.food.findMany({
    where: { userId },
    orderBy: { nome: "asc" },
    include: { _count: { select: { recipeItems: true } } },
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
    usadoEmRefeicoes: a._count.recipeItems,
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

async function Metricas({ userId, hoje }: { userId: string; hoje: Date }) {
  const [{ pontos, atual, variacao30d, alvo, temMeta }, registros, perfil] = await Promise.all([
    evolucaoPeso(userId, hoje),
    db.weightLog.findMany({
      where: { userId },
      orderBy: { data: "desc" },
      take: 40,
    }),
    db.profile.findUnique({
      where: { id: userId },
      select: { revisarPesoACada: true, proximaRevisaoPeso: true },
    }),
  ]);

  const view: RegistroPeso[] = registros.map((r) => ({
    id: r.id,
    data: dayKeySP(r.data),
    dataLabel: mediumDate(r.data),
    pesoKg: r.pesoKg,
    cintura: r.cintura,
    braco: r.braco,
    percentualGordura: r.percentualGordura,
    massaMuscular: r.massaMuscular,
    aguaCorporal: r.aguaCorporal,
    massaOssea: r.massaOssea,
    gorduraVisceral: r.gorduraVisceral,
    tmb: r.tmb,
  }));

  const distancia = atual != null ? atual - alvo : null;
  // Polaridade vem da direção da meta, nunca do sinal cru: emagrecer = subir é ruim,
  // ganhar peso = subir é bom. Sem meta definida, a variação de peso é neutra —
  // não faz sentido pintar de vermelho o ganho de peso de quem está em bulking.
  const pesoUpIsBad = !temMeta ? ("neutral" as const) : alvo < (atual ?? alvo);

  const vencido = !!perfil?.proximaRevisaoPeso && perfil.proximaRevisaoPeso <= hoje;

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
        upIsBad={pesoUpIsBad}
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

      <LembretePesoCard
        revisarACada={perfil?.revisarPesoACada ?? null}
        proximaRevisao={perfil?.proximaRevisaoPeso ? mediumDate(perfil.proximaRevisaoPeso) : null}
        vencido={vencido}
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
