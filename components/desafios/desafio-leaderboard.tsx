import { Card, CardLabel } from "@/components/caverna/card";
import { Flame } from "@/components/caverna/flame";
import { cn, initials } from "@/lib/utils";
import type { MembroDesafio } from "@/lib/data/desafios";

export function DesafioLeaderboard({ membros }: { membros: MembroDesafio[] }) {
  const ranking = [...membros].sort((a, b) => b.pontosTotais - a.pontosTotais);

  return (
    <Card>
      <CardLabel>Ranking</CardLabel>
      <div className="mt-3 flex flex-col gap-1">
        {ranking.map((membro, idx) => (
          <div
            key={membro.userId}
            className="flex items-center gap-3 rounded-[12px] px-2 py-2 transition-colors hover:bg-surface-2/40"
          >
            <span
              className={cn(
                "tabular w-4 shrink-0 text-center text-[12px]",
                idx === 0 ? "text-amber" : "text-steel"
              )}
            >
              {idx + 1}
            </span>
            <div className="relative shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-[11px] text-mist">
                {initials(membro.nome, "?")}
              </div>
              {membro.streak > 0 && (
                <Flame streak={membro.streak} size={16} className="absolute -bottom-1 -right-1" />
              )}
            </div>
            <p className="min-w-0 flex-1 truncate text-[13px] text-ice">{membro.nome ?? "Sem nome"}</p>
            <span className="tabular shrink-0 text-[12.5px] text-mist">
              {membro.pontosTotais} pts
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
