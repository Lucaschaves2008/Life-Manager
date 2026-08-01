"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Loader2, LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/actions/auth";
import { cn, initials } from "@/lib/utils";

export function AccountMenu({
  nome,
  email,
  avatarUrl,
  collapsed,
}: {
  nome: string | null;
  email: string;
  avatarUrl: string | null;
  collapsed: boolean;
}) {
  const [saindo, startSaindo] = useTransition();

  // Não usar <form action={signOut}> aqui: o item vive dentro do Portal do
  // dropdown, que o Radix desmonta no onSelect — o form saía do DOM antes de
  // o browser processar o submit ("form is not connected") e o logout nunca
  // acontecia. O preventDefault mantém o menu montado durante a transição.
  const sair = (event: Event) => {
    event.preventDefault();
    startSaindo(async () => {
      await signOut();
    });
  };

  const avatar = (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-mint-soft text-[12px] font-medium text-mint">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(nome, email)
      )}
    </div>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={collapsed ? nome || email : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-left transition-colors duration-200 hover:bg-surface-2/60",
            collapsed && "justify-center px-0"
          )}
        >
          {avatar}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-ice">{nome || email}</p>
              <p className="truncate text-[11.5px] text-steel">{email}</p>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuItem asChild>
          <Link href="/configuracoes">
            <User className="h-4 w-4 text-steel" strokeWidth={1.5} />
            Perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          destructive
          disabled={saindo}
          onSelect={sair}
          className={cn(saindo && "opacity-60")}
        >
          {saindo ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
          ) : (
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
          )}
          {saindo ? "Saindo…" : "Sair"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
