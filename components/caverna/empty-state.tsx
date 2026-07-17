import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Empty state desenhado: ícone lucide grande em steel a 40% + frase curta.
 */
export function EmptyState({
  icon: Icon,
  title,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-10 text-center",
        className
      )}
    >
      <Icon className="h-10 w-10 text-steel/40" strokeWidth={1.5} />
      <p className="max-w-[32ch] text-[13.5px] text-mist">{title}</p>
      {action}
    </div>
  );
}
