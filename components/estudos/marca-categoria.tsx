import { cn } from "@/lib/utils";

/** Marca da categoria/tópico: inicial do nome sobre a cor dela (no lugar do emoji). */
export function MarcaCategoria({
  nome,
  cor,
  className,
}: {
  nome: string;
  cor: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center font-semibold uppercase leading-none",
        className
      )}
      style={{
        background: `color-mix(in srgb, ${cor} 16%, transparent)`,
        color: cor,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${cor} 28%, transparent)`,
      }}
    >
      {nome.trim().charAt(0) || "·"}
    </span>
  );
}
