"use client";

import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LucideIcon } from "lucide-react";

export type DotsMenuItem = {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
};

/** Menu ⋯ de card/linha (3.5.9): Fixar / Editar / Excluir etc. */
export function DotsMenu({ items }: { items: DotsMenuItem[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Mais ações"
          className="rounded-full p-1.5 text-steel transition-colors hover:bg-surface-2 hover:text-ice"
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[150px]">
        {items.map((item, i) => (
          <span key={item.label}>
            {item.destructive && i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              destructive={item.destructive}
              onSelect={item.onSelect}
            >
              {item.icon && (
                <item.icon className="h-4 w-4 text-steel" strokeWidth={1.5} />
              )}
              {item.label}
            </DropdownMenuItem>
          </span>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
