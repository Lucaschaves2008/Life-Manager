"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  Dumbbell,
  LayoutDashboard,
  ListChecks,
  Salad,
  Search,
  Settings,
  Swords,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  CommandDialog,
  CommandDialogContent,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandRoot,
} from "@/components/ui/command";

const destinos = [
  { href: "/", label: "Início", icon: LayoutDashboard },
  { href: "/financas", label: "Finanças", icon: Wallet },
  { href: "/investimentos", label: "Investimentos", icon: TrendingUp },
  { href: "/dieta", label: "Dieta", icon: Salad },
  { href: "/treinos", label: "Treinos", icon: Dumbbell },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/estudos", label: "Estudos", icon: BookOpen },
  { href: "/checklist", label: "Checklist", icon: ListChecks },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/desafios", label: "Desafios", icon: Swords },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function ir(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-[280px] items-center gap-2.5 rounded-[10px] border border-stroke bg-surface px-3 text-[13px] text-steel transition-colors hover:border-stroke-hover hover:text-mist"
      >
        <Search className="h-[15px] w-[15px] shrink-0" strokeWidth={1.5} />
        <span className="truncate">Pesquisar…</span>
        <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 rounded-[5px] border border-stroke bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-steel md:inline-flex">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandDialogContent>
          <CommandRoot shouldFilter>
            <CommandInput placeholder="Ir para..." autoFocus />
            <CommandList>
              <CommandEmpty>Nada encontrado.</CommandEmpty>
              <CommandGroup heading="Navegação">
                {destinos.map((d) => (
                  <CommandItem
                    key={d.href}
                    value={d.label}
                    onSelect={() => ir(d.href)}
                  >
                    <d.icon className="h-4 w-4 shrink-0 text-steel" strokeWidth={1.5} />
                    {d.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </CommandRoot>
        </CommandDialogContent>
      </CommandDialog>
    </>
  );
}
