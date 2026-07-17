import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/insights";
import { CardLabel } from "@/components/caverna/card";

const headlineColor: Record<Insight["severidade"], string> = {
  info: "text-mint",
  atencao: "text-amber",
  alerta: "text-coral",
};

export type HeroMiniCard = {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
};

/**
 * Hero-Insight conversacional — o componente-assinatura nº 1.
 * Headline serif na cor da severidade + parágrafo com o nome do usuário
 * + linha de 3 mini-cards.
 */
export function HeroInsight({
  insight,
  miniCards,
  className,
}: {
  insight: Insight;
  miniCards?: HeroMiniCard[];
  className?: string;
}) {
  return (
    <section className={cn("card-in", className)}>
      <h2
        className={cn(
          "display max-w-[26ch] text-[32px] leading-[1.12] md:text-[40px]",
          headlineColor[insight.severidade]
        )}
      >
        {insight.headline}
      </h2>
      <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-mist">
        {insight.paragrafo}
      </p>

      {miniCards && miniCards.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {miniCards.map((mc) => (
            <div
              key={mc.label}
              className="rounded-[14px] border border-stroke bg-surface px-4 py-3.5 card-hover"
            >
              <CardLabel>{mc.label}</CardLabel>
              <div className="tabular mt-1.5 text-[17px] font-semibold text-paper">
                {mc.value}
              </div>
              {mc.sub && (
                <div className="mt-0.5 text-[12.5px] text-steel">{mc.sub}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
