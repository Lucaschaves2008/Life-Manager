import Link from "next/link";
import { ChevronLeft, ChevronRight, Target } from "lucide-react";
import { addMonths, subMonths } from "date-fns";
import { Card, CardLabel } from "@/components/caverna/card";
import { Donut } from "@/components/caverna/donut";
import { GoalsChecklist } from "@/components/caverna/goals-checklist";
import { db } from "@/lib/db";
import { monthKeySP, monthYear, nowSP } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function mesParaData(mes: string): Date {
  return new Date(`${mes}-15T12:00:00-03:00`);
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes: mesParam } = await searchParams;
  const hojeMes = monthKeySP(nowSP());
  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? "") ? mesParam! : hojeMes;
  const referencia = mesParaData(mes);

  const [goals, historico] = await Promise.all([
    db.goal.findMany({
      where: { mes },
      orderBy: [{ ordem: "asc" }, { id: "asc" }],
    }),
    db.goal.groupBy({ by: ["mes"], orderBy: { mes: "desc" }, take: 8 }),
  ]);

  const feitas = goals.filter((g) => g.feito).length;
  const pct = goals.length > 0 ? (feitas / goals.length) * 100 : 0;
  const completo = goals.length > 0 && feitas === goals.length;

  const anterior = monthKeySP(subMonths(referencia, 1));
  const proximo = monthKeySP(addMonths(referencia, 1));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="display text-[28px] text-paper">
          {monthYear(referencia)}
        </h2>
        <div className="flex items-center gap-1">
          <Link
            href={`/metas?mes=${anterior}`}
            aria-label="Mês anterior"
            className="rounded-full p-2 text-mist transition-colors hover:bg-surface-2 hover:text-ice"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </Link>
          <Link
            href={`/metas?mes=${proximo}`}
            aria-label="Próximo mês"
            className="rounded-full p-2 text-mist transition-colors hover:bg-surface-2 hover:text-ice"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </Link>
        </div>
        {mes !== hojeMes && (
          <Link
            href="/metas"
            className="rounded-full border border-stroke px-3 py-1 text-[12.5px] text-mist transition-colors hover:border-mint hover:text-mint"
          >
            Voltar para hoje
          </Link>
        )}
      </div>

      <div className="stagger grid grid-cols-12 gap-6">
        <Card className="col-span-12 lg:col-span-7">
          <CardLabel>Metas do mês</CardLabel>
          <div className="mt-4">
            <GoalsChecklist goals={goals} mes={mes} />
          </div>
        </Card>

        <Card destaque={completo} className="col-span-12 lg:col-span-5">
          <CardLabel>Progresso</CardLabel>
          <div className="mt-5 flex flex-col gap-6">
            <Donut
              pct={pct}
              center={`${Math.round(pct)}%`}
              centerSub={
                goals.length > 0 ? `${feitas} de ${goals.length}` : "sem metas"
              }
              cor={completo ? "var(--color-mint)" : "var(--color-steel)"}
            />
            <p className="text-[13px] text-mist">
              {goals.length === 0
                ? "Defina as metas deste mês para acompanhar o progresso aqui."
                : completo
                ? "Mês fechado: todas as metas concluídas."
                : `Faltam ${goals.length - feitas} ${
                    goals.length - feitas === 1 ? "meta" : "metas"
                  } para fechar o mês.`}
            </p>
          </div>
        </Card>

        <Card className="col-span-12">
          <CardLabel>Histórico</CardLabel>
          <div className="mt-4 flex flex-wrap gap-2">
            {historico.length === 0 && (
              <p className="flex items-center gap-2 py-2 text-[13px] text-steel">
                <Target className="h-4 w-4" strokeWidth={1.5} />
                Nenhum mês com metas registradas ainda.
              </p>
            )}
            {historico.map((h) => (
              <Link
                key={h.mes}
                href={`/metas?mes=${h.mes}`}
                className={cn(
                  "rounded-full border px-3 py-1 text-[12.5px] capitalize transition-colors",
                  h.mes === mes
                    ? "border-[var(--mint-border)] bg-mint-soft text-mint"
                    : "border-stroke text-mist hover:border-[var(--stroke-hover)] hover:text-ice"
                )}
              >
                {monthYear(mesParaData(h.mes))}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
