"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { Sparkline } from "@/components/caverna/sparkline";
import { VariationBadge } from "@/components/caverna/variation-badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AreaEvolucaoView } from "@/lib/data/metas";

/**
 * Card de evolução de uma área (finanças, treinos, dieta, estudos, investimentos).
 * Frente: emoji + área, número grande, variação vs. período anterior e sparkline.
 * Ao clicar: dialog com o detalhamento e link para o módulo.
 */
export function AreaEvolucao({ area }: { area: AreaEvolucaoView }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group text-left outline-none rounded-[20px] focus-visible:ring-2 focus-visible:ring-mint/40"
        >
          <Card className="relative flex h-full flex-col gap-3 overflow-hidden p-5 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-[var(--stroke-hover)]">
            {/* glow de acento no canto */}
            <span
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full opacity-20 blur-2xl transition-opacity duration-200 group-hover:opacity-30"
              style={{ background: area.cor }}
            />
            <div className="relative flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-[15px] leading-none">{area.emoji}</span>
                <CardLabel>{area.nome}</CardLabel>
              </span>
              <ArrowUpRight
                className="h-3.5 w-3.5 text-steel transition-colors group-hover:text-ice"
                strokeWidth={1.5}
              />
            </div>

            <div className="relative tabular text-[24px] font-semibold leading-none text-paper">
              {area.valor}
            </div>

            <div className="relative flex items-center gap-2 text-[12px] text-steel">
              {typeof area.pct === "number" && (
                <VariationBadge pct={area.pct} upIsBad={area.upIsBad} />
              )}
              <span className="truncate">{area.contexto}</span>
            </div>

            <div className="relative mt-auto pt-3">
              <Sparkline serie={area.serie} cor={area.cor} />
            </div>
          </Card>
        </button>
      </DialogTrigger>

      <DialogContent className="p-0 max-w-md overflow-hidden">
        <div className="relative overflow-hidden px-6 pt-6 pb-5">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full opacity-25 blur-3xl"
            style={{ background: area.cor }}
          />
          <div className="relative">
            <DialogTitle asChild>
              <span className="inline-flex items-center gap-2">
                <span className="text-[16px] leading-none">{area.emoji}</span>
                <CardLabel>{area.nome}</CardLabel>
              </span>
            </DialogTitle>
            <div className="tabular mt-3 flex items-end gap-2.5">
              <span className="display text-[34px] leading-none text-paper">
                {area.valor}
              </span>
              {typeof area.pct === "number" && (
                <VariationBadge
                  pct={area.pct}
                  upIsBad={area.upIsBad}
                  className="mb-0.5"
                />
              )}
            </div>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-mist">
              {area.descricao}
            </p>
          </div>
        </div>

        <div className="border-t border-stroke bg-surface/40 px-6 py-5">
          <div className="flex flex-col gap-3">
            {area.detalhe.map((l, i) => (
              <LinhaRow key={i} {...l} index={i} />
            ))}
          </div>

          {area.total && (
            <div className="mt-5 flex items-center justify-between border-t border-stroke pt-4">
              <span className="text-[13.5px] font-medium text-mist">
                {area.total.label}
              </span>
              <span className="tabular text-[17px] font-semibold text-paper">
                {area.total.valor}
              </span>
            </div>
          )}

          <Link
            href={area.href}
            className="mt-4 inline-flex items-center gap-1 text-[12.5px] text-mist transition-colors hover:text-ice"
          >
            ver {area.nome.toLowerCase()}
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LinhaRow({
  label,
  valor,
  cor = "var(--color-steel)",
  share,
  hint,
  index,
}: AreaEvolucaoView["detalhe"][number] & { index: number }) {
  const pct = Math.max(0, Math.min(1, share ?? 0)) * 100;
  return (
    <div className="row-in" style={{ animationDelay: `${80 + index * 45}ms` }}>
      <div className="flex items-center gap-2.5">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: cor }}
        />
        <span className="flex-1 truncate text-[13.5px] text-ice">{label}</span>
        {hint && (
          <span className="tabular shrink-0 text-[11.5px] text-steel">{hint}</span>
        )}
        <span className="tabular shrink-0 text-[13.5px] font-medium text-paper">
          {valor}
        </span>
      </div>
      {share !== undefined && (
        <div className="mt-1.5 ml-[18px] h-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%`, background: cor }}
          />
        </div>
      )}
    </div>
  );
}
