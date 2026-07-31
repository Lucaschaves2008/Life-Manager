import { cn } from "@/lib/utils";

/**
 * Hierarquia de superfície — 4 níveis, nenhum outro. Antídoto para "tudo é
 * card": a maioria do conteúdo deveria ser `flat` (sem borda, só espaçamento);
 * borda é reservada para agrupamento real (`raised`), ação/estado (`outlined`)
 * ou a métrica-herói da tela (`accent`, no máximo um por tela).
 *
 * `container-type: inline-size` no wrapper permite que filhos usem
 * `@container` para decidir o próprio layout pela largura real do slot
 * (grid vs. sidebar vs. mobile), não pela largura da janela.
 */
export type SurfaceLevel = "flat" | "raised" | "outlined" | "accent";

const LEVEL_CLASSES: Record<SurfaceLevel, string> = {
  flat: "bg-transparent",
  raised: "rounded-[var(--radius-card)] border-0 bg-surface-2",
  outlined: "rounded-[var(--radius-card)] border border-stroke bg-transparent",
  accent: "rounded-[var(--radius-card)] border border-[rgba(13,110,253,.25)] bg-mint-soft",
};

export function Surface({
  level = "flat",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { level?: SurfaceLevel }) {
  return (
    <div
      className={cn("[container-type:inline-size]", LEVEL_CLASSES[level], className)}
      {...props}
    >
      {children}
    </div>
  );
}
