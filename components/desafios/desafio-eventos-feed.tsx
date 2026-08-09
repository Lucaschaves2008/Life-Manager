"use client";

import { Crown, Flame as FlameIcon, Trophy, type LucideIcon } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { useAcao } from "@/lib/acao-cliente";
import { reagirAoEvento, removerReacaoAoEvento } from "@/app/actions/desafios";
import type { DesafioEventoView } from "@/lib/data/desafios-eventos";
import { cn } from "@/lib/utils";

/** Feed de atividade persistente do desafio — eventos automáticos (meta
 * concluída, streak batendo marco, líder da semana) com reação rápida de
 * emoji. Substitui o antigo feed de "insights" ephemeral: os eventos aqui são
 * salvos (DesafioEvento) e sobrevivem entre recarregamentos, o que é o que
 * permite reagir a eles. */

const EMOJIS_REACAO = ["🔥", "👏", "💪", "🎉", "😮"];

const ICONE_POR_TIPO: Record<string, LucideIcon> = {
  meta_concluida: Trophy,
  streak: FlameIcon,
  lidera_semana: Crown,
};

export function DesafioEventosFeed({
  desafioId,
  eventos,
}: {
  desafioId: string;
  eventos: DesafioEventoView[];
}) {
  const [, executar] = useAcao();

  function reagir(evento: DesafioEventoView, emoji: string) {
    const minhaReacao = evento.reacoes.find((r) => r.reagiuEu);
    executar(async () => {
      if (minhaReacao?.emoji === emoji) {
        await removerReacaoAoEvento(desafioId, evento.id);
      } else {
        await reagirAoEvento(desafioId, evento.id, emoji);
      }
    });
  }

  return (
    <Card>
      <CardLabel>Atividade</CardLabel>
      {eventos.length === 0 ? (
        <p className="mt-3 text-[13px] text-steel">
          Sem novidades ainda — quando alguém bater uma meta ou pegar um streak, aparece aqui.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {eventos.map((evento) => {
            const Icone = ICONE_POR_TIPO[evento.tipo] ?? Trophy;
            const minhaReacao = evento.reacoes.find((r) => r.reagiuEu)?.emoji;
            return (
              <div key={evento.id} className="flex flex-col gap-1.5">
                <div className="flex items-start gap-2.5 text-[13px] text-mist">
                  <Icone className="mt-0.5 h-4 w-4 shrink-0 text-mint" strokeWidth={1.5} />
                  <p>{evento.texto}</p>
                </div>
                <div className="ml-6.5 flex flex-wrap items-center gap-1">
                  {evento.reacoes.map((r) => (
                    <button
                      key={r.emoji}
                      onClick={() => reagir(evento, r.emoji)}
                      className={cn(
                        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] transition-colors",
                        r.reagiuEu
                          ? "border-mint/40 bg-mint-soft text-ice"
                          : "border-stroke bg-surface-2 text-mist hover:text-ice"
                      )}
                    >
                      <span className="notranslate" translate="no">
                        {r.emoji}
                      </span>
                      <span className="tabular">{r.count}</span>
                    </button>
                  ))}
                  {EMOJIS_REACAO.filter((e) => e !== minhaReacao).map((e) => (
                    <button
                      key={e}
                      aria-label={`Reagir com ${e}`}
                      onClick={() => reagir(evento, e)}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-stroke bg-surface-2 text-[12.5px] text-mist transition-colors hover:border-[rgba(13,110,253,.4)] hover:text-ice"
                    >
                      <span className="notranslate" translate="no">
                        {e}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
