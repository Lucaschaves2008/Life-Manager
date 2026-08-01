"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type PillTab = {
  label: string;
  href: string;
  icon?: LucideIcon;
  /** valor do search param `tab` quando a navegação é por query */
  value?: string;
};

function PillTabsInner({
  tabs,
  param,
  className,
  inline = false,
}: {
  tabs: PillTab[];
  param?: string;
  className?: string;
  /** quando true, não cria seu próprio flex-wrap — os pills viram irmãos diretos do container pai */
  inline?: boolean;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const current = param ? (search.get(param) ?? tabs[0]?.value) : null;

  const isActive = (tab: PillTab) =>
    param ? current === tab.value : pathname === tab.href;

  return (
    <nav
      className={cn(inline ? "contents" : "flex flex-wrap items-center gap-2", className)}
      aria-label="Subnavegação"
    >
      {tabs.map((tab) => {
        const active = isActive(tab);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            scroll={false}
            className={cn(
              "inline-flex h-8.5 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[13px] transition-colors duration-200",
              active
                ? "border-[rgba(13,110,253,.25)] bg-mint-soft text-mint"
                : "border-stroke text-mist hover:border-[rgba(143,169,205,.22)] hover:text-ice"
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Pill-tabs de subnavegação (3.5.3): ativa menta-soft, inativas stroke. */
export function PillTabs(props: {
  tabs: PillTab[];
  param?: string;
  className?: string;
  inline?: boolean;
}) {
  return (
    <Suspense fallback={<div className="h-8.5" />}>
      <PillTabsInner {...props} />
    </Suspense>
  );
}
