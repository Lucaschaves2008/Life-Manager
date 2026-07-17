"use client";

import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = { label: string; value: T };

/**
 * Segmented control (3.5.6): Dia · Semana · Mês · Ano.
 * Item ativo: fundo elevated + texto ice.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-stroke bg-surface p-1",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "cursor-pointer rounded-full px-3.5 py-1 text-[12.5px] transition-colors duration-200",
              active
                ? "bg-elevated text-ice"
                : "text-mist hover:text-ice"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
