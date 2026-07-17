"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  Dumbbell,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Salad,
  Settings,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { LcLogo } from "@/components/shell/lc-logo";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

const painel: NavItem[] = [
  { href: "/", label: "Início", icon: LayoutDashboard },
];

const modulos: NavItem[] = [
  { href: "/financas", label: "Finanças", icon: Wallet },
  { href: "/investimentos", label: "Investimentos", icon: TrendingUp },
  { href: "/dieta", label: "Dieta", icon: Salad },
  { href: "/treinos", label: "Treinos", icon: Dumbbell },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/estudos", label: "Estudos", icon: BookOpen },
];

const extras: NavItem[] = [
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] transition-colors duration-200",
        active
          ? "bg-surface-2 text-ice"
          : "text-mist hover:bg-surface-2/60 hover:text-ice",
        collapsed && "justify-center px-0"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-mint" />
      )}
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

export function Sidebar({
  collapsed,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const group = (label: string, items: NavItem[]) => (
    <div className="flex flex-col gap-0.5">
      {!collapsed && (
        <p className="microlabel px-3 pb-1.5 pt-4 !text-[10px] text-steel">
          {label}
        </p>
      )}
      {collapsed && <div className="h-4" />}
      {items.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          active={isActive(item.href)}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );

  return (
    <div className="flex h-full flex-col px-2.5 py-5">
      <div className="relative flex items-center justify-center px-3">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-[14px] px-2 py-2 transition-colors hover:bg-surface-2"
        >
          <LcLogo className={collapsed ? "h-7" : "h-8"} />
        </Link>
        {onToggle && (
          <button
            onClick={onToggle}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className="absolute right-2 rounded-lg p-1.5 text-steel transition-colors hover:bg-surface-2 hover:text-mist"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4.5 w-4.5" strokeWidth={1.5} />
            ) : (
              <PanelLeftClose className="h-4.5 w-4.5" strokeWidth={1.5} />
            )}
          </button>
        )}
      </div>

      <nav className="mt-4 flex flex-1 flex-col">
        {group("Painel", painel)}
        {group("Módulos", modulos)}
        <div className="mt-auto">{group("", extras)}</div>
      </nav>
    </div>
  );
}
