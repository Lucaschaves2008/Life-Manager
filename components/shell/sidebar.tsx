"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  Dumbbell,
  LayoutDashboard,
  ListChecks,
  Salad,
  ShieldCheck,
  Swords,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { LcLogo } from "@/components/shell/lc-logo";
import { AccountMenu } from "@/components/shell/account-menu";
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
  { href: "/checklist", label: "Checklist", icon: ListChecks },
];

const extras: NavItem[] = [
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/desafios", label: "Desafios", icon: Swords },
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
  isSuperAdmin = false,
  user,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  isSuperAdmin?: boolean;
  user: { nome: string | null; email: string; avatarUrl: string | null };
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const adminItems: NavItem[] = isSuperAdmin
    ? [{ href: "/admin", label: "Admin", icon: ShieldCheck }]
    : [];

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
    <div className="relative flex h-full flex-col">
      {/* 65px = h-16 da topbar + borda, para a linha divisória ser contínua na tela */}
      <div
        className={cn(
          "flex h-[65px] shrink-0 items-center border-b border-stroke",
          collapsed ? "justify-center px-2" : "px-5"
        )}
      >
        <Link
          href="/"
          className="inline-flex items-center transition-opacity hover:opacity-80"
        >
          <LcLogo className="h-7 shrink-0" />
        </Link>
      </div>

      {onToggle && (
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className="absolute -right-3.5 top-[88px] z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-stroke bg-surface text-steel shadow-sm transition-colors hover:text-ice"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform duration-300",
              collapsed && "rotate-180"
            )}
            strokeWidth={2}
          />
        </button>
      )}

      <nav className="flex flex-1 flex-col px-2.5 pb-5">
        {group("Painel", painel)}
        {group("Módulos", modulos)}
        {isSuperAdmin && group("Administração", adminItems)}
        <div className="mt-auto">
          {group("", extras)}
          <div className="mt-1 border-t border-stroke pt-2">
            <AccountMenu
              nome={user.nome}
              email={user.email}
              avatarUrl={user.avatarUrl}
              collapsed={collapsed}
            />
          </div>
        </div>
      </nav>
    </div>
  );
}
