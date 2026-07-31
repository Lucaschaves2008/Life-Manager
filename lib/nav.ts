import type { ComponentType } from "react";
import {
  BookOpen,
  CalendarDays,
  CalendarPlus,
  Dumbbell,
  LayoutDashboard,
  ListChecks,
  PiggyBank,
  ReceiptText,
  Salad,
  ShieldCheck,
  Swords,
  Target,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";

export type NavIcon = ComponentType<{ className?: string; strokeWidth?: number }>;

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
};

/** Manifesto único de navegação — sidebar (desktop) e bottom tab bar (mobile) leem daqui. */
export const NAV_PAINEL: NavItem[] = [{ href: "/", label: "Início", icon: LayoutDashboard }];

export const NAV_MODULOS: NavItem[] = [
  { href: "/financas", label: "Finanças", icon: Wallet },
  { href: "/investimentos", label: "Investimentos", icon: TrendingUp },
  { href: "/dieta", label: "Dieta", icon: Salad },
  { href: "/treinos", label: "Treinos", icon: Dumbbell },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/estudos", label: "Estudos", icon: BookOpen },
  { href: "/checklist", label: "Checklist", icon: ListChecks },
];

export const NAV_EXTRAS: NavItem[] = [
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/desafios", label: "Desafios", icon: Swords },
];

export const NAV_ADMIN: NavItem = { href: "/admin", label: "Admin", icon: ShieldCheck };

/**
 * Os 5 slots da bottom tab bar mobile: Início · Treinos · [FAB] · Finanças · Mais.
 * Escolhidos por frequência de uso esperada (confirmado com o usuário em
 * 2026-07-31), não pela ordem do menu desktop. "Mais" abre o sheet com o
 * grid completo dos módulos restantes — nunca uma rota nova.
 */
export const TAB_BAR_ESQUERDA: NavItem = { href: "/", label: "Início", icon: LayoutDashboard };
export const TAB_BAR_TREINOS: NavItem = { href: "/treinos", label: "Treinos", icon: Dumbbell };
export const TAB_BAR_FINANCAS: NavItem = { href: "/financas", label: "Finanças", icon: Wallet };

/** Módulos que vivem atrás do "Mais" no mobile — todo o resto do manifesto. */
export const NAV_MAIS: NavItem[] = [
  { href: "/investimentos", label: "Investimentos", icon: TrendingUp },
  { href: "/dieta", label: "Dieta", icon: Salad },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/estudos", label: "Estudos", icon: BookOpen },
  { href: "/checklist", label: "Checklist", icon: ListChecks },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/desafios", label: "Desafios", icon: Swords },
];

/** Ações do FAB contextual — mesma lista usada pelo dropdown "Novo" da topbar. */
export type NovoItem = { label: string; href: string; icon: NavIcon };

export const NOVO_ITEMS: NovoItem[] = [
  { label: "Transação", href: "/financas?novo=1", icon: ReceiptText },
  { label: "Treino", href: "/treinos?novo=1", icon: Dumbbell },
  { label: "Refeição", href: "/dieta?novo=1", icon: UtensilsCrossed },
  { label: "Evento", href: "/agenda?novo=1", icon: CalendarPlus },
  { label: "Aporte", href: "/investimentos?novo=1", icon: PiggyBank },
];

/**
 * Ordem contextual do FAB por rota: o item relevante à tela atual vem
 * primeiro. Fora de uma rota mapeada, cai na ordem padrão de NOVO_ITEMS.
 */
export function novoItemsParaRota(pathname: string): NovoItem[] {
  const prioridade: Record<string, string> = {
    "/treinos": "Treino",
    "/financas": "Transação",
    "/dieta": "Refeição",
    "/agenda": "Evento",
    "/investimentos": "Aporte",
  };
  const rotaBase = "/" + (pathname.split("/")[1] ?? "");
  const labelPrioritario = prioridade[rotaBase];
  if (!labelPrioritario) return NOVO_ITEMS;
  const item = NOVO_ITEMS.find((i) => i.label === labelPrioritario);
  if (!item) return NOVO_ITEMS;
  return [item, ...NOVO_ITEMS.filter((i) => i.label !== labelPrioritario)];
}
