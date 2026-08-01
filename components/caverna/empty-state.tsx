import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Empty state: ícone lucide num halo suave + título curto + (opcional) uma
 * linha de apoio e um botão de ação primária.
 *
 * `title` é o estado ("Nenhum treino registrado ainda"); `description` é o
 * convite à ação em linguagem humana; `action` é o botão que resolve o vazio.
 * A intenção é nunca só informar ausência de dado — todo empty state que
 * tem uma ação óbvia deve oferecê-la ali mesmo.
 *
 * `variant="inline"` reduz o respiro para caixas pequenas (dentro de um card
 * lateral, uma coluna estreita), onde o padding do padrão fica desproporcional.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "default",
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "inline";
  className?: string;
}) {
  const inline = variant === "inline";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        inline ? "gap-2 py-6" : "gap-3 py-10",
        className
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full border border-stroke bg-surface-2",
          inline ? "h-10 w-10" : "h-14 w-14"
        )}
        aria-hidden
      >
        <Icon
          className={cn("text-steel/60", inline ? "h-[18px] w-[18px]" : "h-6 w-6")}
          strokeWidth={1.5}
        />
      </span>

      <div className={cn("flex flex-col", inline ? "gap-0.5" : "gap-1")}>
        <p
          className={cn(
            "max-w-[34ch] text-ice",
            inline ? "text-[13px]" : "text-[14px] font-medium"
          )}
        >
          {title}
        </p>
        {description && (
          <p className="max-w-[38ch] text-[12.5px] leading-relaxed text-mist">
            {description}
          </p>
        )}
      </div>

      {action && <div className={inline ? "mt-0.5" : "mt-1"}>{action}</div>}
    </div>
  );
}
