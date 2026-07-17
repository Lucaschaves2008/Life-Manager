import { cn } from "@/lib/utils";

/**
 * Card base do Caverna: superfície #0B111E, borda 1px stroke, raio 20px, padding 24px.
 * `destaque` = o ÚNICO card menta-soft permitido por seção.
 */
export function Card({
  className,
  destaque = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { destaque?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[20px] border p-6 card-hover",
        destaque
          ? "border-[rgba(62,224,143,.25)] bg-mint-soft"
          : "border-stroke bg-surface",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Micro-label de seção: 11px, caps, tracking 0.10em. */
export function CardLabel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("microlabel", className)} {...props}>
      {children}
    </p>
  );
}
