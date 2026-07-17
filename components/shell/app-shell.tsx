"use client";

import { useState } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Sidebar desktop */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-stroke bg-surface transition-[width] duration-300 lg:block",
          collapsed ? "w-16" : "w-[232px]"
        )}
      >
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
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
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-16 pt-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
