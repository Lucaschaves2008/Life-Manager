import { Sparkles, Trophy } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import type { InsightView } from "@/lib/data/desafios-insights";

export function InsightsFeed({ insights }: { insights: InsightView[] }) {
  return (
    <Card>
      <CardLabel>Atividade</CardLabel>
      {insights.length === 0 ? (
        <p className="mt-3 text-[13px] text-steel">
          Sem novidades ainda — quando alguém se destacar numa meta, aparece aqui.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5">
          {insights.map((insight) => (
            <div key={insight.id} className="flex items-start gap-2.5 text-[13px] text-mist">
              {insight.tipo === "concluida" ? (
                <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-mint" strokeWidth={1.5} />
              ) : (
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-steel" strokeWidth={1.5} />
              )}
              <p>{insight.texto}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
