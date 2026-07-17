"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  CalendarPlus,
  Dumbbell,
  Menu,
  PiggyBank,
  Plus,
  ReceiptText,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fullDate, nowSP } from "@/lib/dates";

const titles: [string, string][] = [
  ["/financas", "Finanças"],
  ["/investimentos", "Investimentos"],
  ["/dieta", "Dieta"],
  ["/treinos", "Treinos"],
  ["/agenda", "Agenda"],
  ["/estudos", "Estudos"],
  ["/metas", "Metas"],
  ["/configuracoes", "Configurações"],
];

function pageTitle(pathname: string): string {
  const found = titles.find(([href]) => pathname.startsWith(href));
  return found ? found[1] : "Painel Caverna";
}

const novoItems = [
  { label: "Transação", href: "/financas/transacoes?novo=1", icon: ReceiptText },
  { label: "Treino", href: "/treinos?novo=1", icon: Dumbbell },
  { label: "Refeição", href: "/dieta?novo=1", icon: UtensilsCrossed },
  { label: "Evento", href: "/agenda?novo=1", icon: CalendarPlus },
  { label: "Aporte", href: "/investimentos?novo=1", icon: PiggyBank },
];

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  // data renderizada apenas no cliente para evitar mismatch de hidratação na virada do dia
  const [hoje, setHoje] = useState<string>("");
  useEffect(() => {
    setHoje(fullDate(nowSP()));
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-stroke bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-4 px-4 md:px-8">
        <button
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="rounded-lg p-2 text-mist hover:bg-surface-2 lg:hidden"
        >
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </button>

        <h1 className="display text-[22px] text-paper">{pageTitle(pathname)}</h1>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-[13px] text-mist md:block" suppressHydrationWarning>
            {hoje}
          </span>

          <Link
            href="/agenda"
            aria-label="Notificações"
            className="relative rounded-full p-2 text-mist transition-colors hover:bg-surface-2 hover:text-ice"
            id="sino-notificacoes"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="primary" size="sm">
                <Plus className="h-4 w-4" strokeWidth={2} />
                Novo
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {novoItems.map((item) => (
                <DropdownMenuItem key={item.label} asChild>
                  <Link href={item.href}>
                    <item.icon className="h-4 w-4 text-steel" strokeWidth={1.5} />
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
