"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { MobileTabBar } from "@/components/shell/mobile-tab-bar";
import { cn } from "@/lib/utils";

const SEM_SHELL = ["/login", "/bloqueado"];

type ShellUser = { nome: string | null; email: string; avatarUrl: string | null };

export function AppShell({
  children,
  isSuperAdmin = false,
  user,
  notificacoesSlot,
  streakSlot,
}: {
  children: React.ReactNode;
  isSuperAdmin?: boolean;
  user: ShellUser;
  notificacoesSlot?: React.ReactNode;
  streakSlot?: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const saved = window.localStorage.getItem("life-manager-theme");
    const initial =
      saved === "light" || saved === "dark"
        ? saved
        : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    document.documentElement.dataset.theme = initial;
  }, []);

  if (SEM_SHELL.some((p) => pathname.startsWith(p))) {
    return <div className="min-h-dvh bg-bg">{children}</div>;
  }

  return (
    <div className="flex min-h-dvh bg-bg">
      {/* Sidebar desktop */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden overflow-visible border-r border-stroke bg-surface transition-[width] duration-300 lg:block",
          collapsed ? "w-16" : "w-[232px]"
        )}
      >
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          isSuperAdmin={isSuperAdmin}
          user={user}
        />
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-[232px] border-r border-stroke bg-surface shadow-[0_16px_48px_rgba(0,0,0,.5)]">
            <Sidebar
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
              isSuperAdmin={isSuperAdmin}
              user={user}
            />
          </aside>
        </div>
      )}

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-[margin] duration-300",
          collapsed ? "lg:ml-16" : "lg:ml-[232px]"
        )}
      >
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          notificacoesSlot={notificacoesSlot}
          streakSlot={streakSlot}
        />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-6 pb-[calc(var(--nav-height)+var(--safe-bottom)+16px)] md:px-8 lg:pb-16">
          {children}
        </main>
      </div>

      <MobileTabBar />
    </div>
  );
}
