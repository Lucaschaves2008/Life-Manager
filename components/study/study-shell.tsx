"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen } from "lucide-react";

const tabs = [
  { href: "/estudos", label: "Timer" },
  { href: "/estudos/sessoes", label: "Sessões" },
  { href: "/estudos/dashboard", label: "Dashboard" },
] as const;

export function StudyShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-full border border-[var(--color-stroke)]/70 bg-[rgba(9,13,22,0.7)] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-[var(--color-mint-soft)] p-2 text-[var(--color-mint)]">
            <BookOpen className="size-4" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[var(--color-steel)]">Módulo extra</p>
            <h1 className="text-lg font-semibold text-[var(--color-paper)]">Relógio de estudo</h1>
          </div>
        </div>
        <div className="flex rounded-full border border-[var(--color-stroke)] bg-[var(--color-surface)] p-1">
          {tabs.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm capitalize transition ${active ? "bg-[var(--color-mint)] text-[var(--color-bg)]" : "text-[var(--color-mist)]"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </section>
      {children}
    </div>
  );
}
