import { cn } from "@/lib/utils";

/**
 * Tabela minimal (3.5.11): header 11px caps mist, linhas 52px,
 * divisórias stroke, sem zebra, valores tabular-nums.
 */
export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse", className)} {...props} />
    </div>
  );
}

export function THead({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <thead>
      <tr className="border-b border-stroke">{children}</tr>
    </thead>
  );
}

export function Th({
  className,
  right = false,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { right?: boolean }) {
  return (
    <th
      className={cn(
        "microlabel pb-2.5 pt-1 font-medium",
        right ? "text-right" : "text-left",
        className
      )}
      {...props}
    />
  );
}

export function Tr({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "h-[52px] border-b border-stroke transition-colors last:border-0 hover:bg-surface-2/40",
        className
      )}
      {...props}
    />
  );
}

export function Td({
  className,
  right = false,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { right?: boolean }) {
  return (
    <td
      className={cn(
        "px-2 text-[13.5px] text-ice first:pl-0 last:pr-0",
        right && "tabular text-right",
        className
      )}
      {...props}
    />
  );
}

/** Pill de status: Pago, Pendente, Ativa, Pausada… */
export function StatusPill({
  tone,
  children,
}: {
  tone: "mint" | "amber" | "coral" | "steel";
  children: React.ReactNode;
}) {
  const tones = {
    mint: "bg-mint-soft text-mint",
    amber: "bg-amber-soft text-amber",
    coral: "bg-coral-soft text-coral",
    steel: "bg-surface-2 text-mist",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-medium",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}
