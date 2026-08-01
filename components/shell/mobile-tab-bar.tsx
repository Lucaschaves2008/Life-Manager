"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Check, Grid2x2, Plus, Settings2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  NAV_MAIS,
  TAB_BAR_ESQUERDA,
  TAB_BAR_SLOT_OPCOES,
  novoItemsParaRota,
  type NavItem,
} from "@/lib/nav";
import { useTabBarPrefs } from "@/lib/use-tab-bar-prefs";

/**
 * Bottom tab bar mobile: Início · Treinos · [FAB] · Finanças · Mais.
 * Ícone + label sempre visível (Strava/Garmin não escondem o label — não é
 * falta de elegância, é acerto). Estado ativo em duas dimensões: cor +
 * peso do ícone, nunca só cor. 56px + safe-bottom, alvo de toque ≥ 48px.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const [novoOpen, setNovoOpen] = useState(false);
  const [maisOpen, setMaisOpen] = useState(false);
  const [personalizarOpen, setPersonalizarOpen] = useState(false);
  const { esquerda, direita, setSlot } = useTabBarPrefs();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const novoItems = novoItemsParaRota(pathname);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-stroke bg-surface/95 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "var(--safe-bottom)" }}
        aria-label="Navegação principal"
      >
        <div className="grid h-[var(--nav-height)] grid-cols-5 items-stretch">
          <TabLink item={TAB_BAR_ESQUERDA} active={isActive(TAB_BAR_ESQUERDA.href)} />
          <TabLink item={esquerda} active={isActive(esquerda.href)} />

          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => setNovoOpen(true)}
              aria-label="Criar novo registro"
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full",
                "bg-brand text-bg shadow-[0_4px_16px_rgba(0,0,0,.35)]",
                "transition-transform active:scale-95"
              )}
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>

          <TabLink item={direita} active={isActive(direita.href)} />

          <button
            type="button"
            onClick={() => setMaisOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 text-[10.5px] transition-colors",
              maisOpen ? "text-ice" : "text-mist"
            )}
            aria-label="Mais módulos"
          >
            <Grid2x2 className="h-[20px] w-[20px]" strokeWidth={maisOpen ? 2 : 1.5} />
            Mais
          </button>
        </div>
      </nav>

      {/* FAB contextual: ação relevante à rota atual vem primeiro. */}
      <Sheet open={novoOpen} onOpenChange={setNovoOpen}>
        <SheetContent side="bottom">
          <SheetTitle>Novo registro</SheetTitle>
          <SheetDescription>O que você quer lançar agora?</SheetDescription>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {novoItems.map((item, i) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setNovoOpen(false)}
                className={cn(
                  "flex flex-col items-start gap-2.5 rounded-[var(--radius-inner)] border border-stroke p-4",
                  "min-h-[var(--tap-capture)] transition-colors active:bg-surface-2",
                  i === 0 && "border-[rgba(13,110,253,.3)] bg-mint-soft"
                )}
              >
                <item.icon className="h-5 w-5 text-ice" strokeWidth={1.5} />
                <span className="text-[13.5px] text-ice">{item.label}</span>
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Grid completo dos módulos que não cabem na tab bar. */}
      <Sheet open={maisOpen} onOpenChange={setMaisOpen}>
        <SheetContent side="bottom">
          <SheetTitle>Mais módulos</SheetTitle>
          <SheetDescription>Todos os espaços do MYLIFE.</SheetDescription>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {NAV_MAIS.map((item) => (
              <MaisTile key={item.href} item={item} onNavigate={() => setMaisOpen(false)} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setMaisOpen(false);
              setPersonalizarOpen(true);
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-[var(--radius-inner)] border border-stroke py-3 text-[13.5px] text-mist transition-colors active:bg-surface-2"
          >
            <Settings2 className="h-4 w-4" strokeWidth={1.5} />
            Personalizar menu
          </button>
        </SheetContent>
      </Sheet>

      {/* Escolha de quais módulos ocupam os 2 slots configuráveis da tab bar. */}
      <Sheet open={personalizarOpen} onOpenChange={setPersonalizarOpen}>
        <SheetContent side="bottom">
          <SheetTitle>Personalizar menu</SheetTitle>
          <SheetDescription>Escolha o que aparece nas 2 posições livres da barra inferior.</SheetDescription>

          <SlotPicker
            label="Posição 2"
            selecionado={esquerda.href}
            onSelect={(href) => setSlot("esquerda", href)}
          />
          <SlotPicker
            label="Posição 4"
            selecionado={direita.href}
            onSelect={(href) => setSlot("direita", href)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

function SlotPicker({
  label,
  selecionado,
  onSelect,
}: {
  label: string;
  selecionado: string;
  onSelect: (href: string) => void;
}) {
  return (
    <div className="mt-5">
      <p className="mb-2.5 text-[11.5px] uppercase tracking-wide text-mist">{label}</p>
      <div className="grid grid-cols-3 gap-2.5">
        {TAB_BAR_SLOT_OPCOES.map((item) => {
          const Icon = item.icon;
          const ativo = item.href === selecionado;
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => onSelect(item.href)}
              className={cn(
                "relative flex min-h-[var(--tap-comfortable)] flex-col items-center justify-center gap-2 rounded-[var(--radius-inner)] border py-4 text-center transition-colors",
                ativo ? "border-ice bg-mint-soft" : "border-stroke active:bg-surface-2"
              )}
            >
              {ativo && (
                <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-ice" strokeWidth={2.5} />
              )}
              <Icon className={cn("h-5 w-5", ativo ? "text-ice" : "text-mist")} strokeWidth={1.5} />
              <span className={cn("text-[11.5px]", ativo ? "text-ice" : "text-mist")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 text-[10.5px] transition-colors",
        active ? "text-ice" : "text-mist"
      )}
    >
      <Icon className="h-[20px] w-[20px]" strokeWidth={active ? 2 : 1.5} />
      {item.label}
    </Link>
  );
}

function MaisTile({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className="flex min-h-[var(--tap-comfortable)] flex-col items-center justify-center gap-2 rounded-[var(--radius-inner)] border border-stroke py-4 text-center transition-colors active:bg-surface-2"
    >
      <Icon className="h-5 w-5 text-ice" strokeWidth={1.5} />
      <span className="text-[11.5px] text-mist">{item.label}</span>
    </Link>
  );
}
