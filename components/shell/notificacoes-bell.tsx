"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NotificacaoRevisao } from "@/lib/data/notificacoes";
import { cn } from "@/lib/utils";

function rotuloRevisao(n: NotificacaoRevisao): string {
  if (n.vencida) {
    const dias = Math.abs(n.diasRestantes);
    return `Revisão atrasada há ${dias} ${dias === 1 ? "dia" : "dias"}`;
  }
  if (n.diasRestantes === 0) return "Revisar hoje";
  if (n.diasRestantes === 1) return "Revisar amanhã";
  return `Revisar em ${n.diasRestantes} dias`;
}

export function NotificacoesBell({
  notificacoes = [],
}: {
  notificacoes?: NotificacaoRevisao[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Notificações"
          className="relative rounded-full p-2 text-mist transition-colors hover:bg-surface-2 hover:text-ice"
          id="sino-notificacoes"
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.5} />
          {notificacoes.length > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-medium leading-none text-white">
              {notificacoes.length}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[280px]">
        <DropdownMenuLabel>Revisão de investimentos</DropdownMenuLabel>
        {notificacoes.length === 0 ? (
          <p className="px-3 py-4 text-center text-[12.5px] text-steel">
            Nenhuma revisão pendente.
          </p>
        ) : (
          <>
            <DropdownMenuSeparator />
            {notificacoes.map((n) => (
              <DropdownMenuItem key={n.id} asChild>
                <Link
                  href={`/investimentos?revisar=${n.assetId}`}
                  className="flex-col items-start gap-0.5"
                >
                  <span className="flex w-full items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: n.cor }}
                    />
                    <span className="truncate text-[13px] text-ice">
                      {n.nome}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "pl-4 text-[11.5px]",
                      n.vencida ? "text-coral" : "text-steel"
                    )}
                  >
                    {rotuloRevisao(n)} · {n.instituicao}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
