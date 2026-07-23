"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { excluirMetaQuantitativa } from "@/app/actions/metas-quantitativas";
import type { MetaQuantitativaView } from "@/lib/data/metas-quantitativas";
import { MetaQuantitativaSheet } from "@/components/metas/meta-quantitativa-sheet";
import { cn } from "@/lib/utils";

function formatNumero(v: number): string {
  return v % 1 === 0 ? v.toFixed(0) : v.toFixed(1);
}

function LinhaMeta({ meta }: { meta: MetaQuantitativaView }) {
  const [, startTransition] = useTransition();
  const [removendo, setRemovendo] = useState(false);
  const pctBarra = Math.max(0, Math.min(100, meta.pct));
  const excedeu = meta.pct > 100;
  const cor = meta.pct >= 100 ? "var(--color-mint)" : meta.noPrazo ? "var(--color-mint)" : "var(--cal-amber)";

  return (
    <div
      className={cn(
        "group rounded-[14px] border border-stroke bg-surface px-4 py-3.5 transition-opacity",
        removendo && "opacity-40"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] text-ice">{meta.titulo}</p>
          <p className="mt-0.5 text-[11.5px] text-steel">{meta.periodoLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              meta.pct >= 100
                ? "bg-mint-soft text-mint"
                : meta.noPrazo
                ? "bg-mint-soft text-mint"
                : "bg-amber-soft text-amber"
            )}
          >
            {meta.pct >= 100 ? "concluída" : meta.noPrazo ? "no prazo" : "atrasada"}
          </span>
          <button
            aria-label="Excluir meta"
            onClick={() => {
              setRemovendo(true);
              startTransition(async () => {
                await excluirMetaQuantitativa(meta.id);
                toast.success("Meta excluída");
              });
            }}
            className="rounded-md p-1 text-steel opacity-0 transition-opacity hover:text-coral group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pctBarra}%`, background: cor }}
          />
        </div>
        <span className="tabular shrink-0 text-[12.5px] text-mist">
          {formatNumero(meta.atual)} / {formatNumero(meta.alvo)} {meta.unidade}
          {excedeu && <span className="ml-1 text-mint">+{Math.round(meta.pct - 100)}%</span>}
        </span>
      </div>

      {meta.pct < 100 && meta.diasRestantes > 0 && (
        <p className="mt-1.5 text-[11px] text-steel">
          {meta.diasRestantes} {meta.diasRestantes === 1 ? "dia restante" : "dias restantes"}
        </p>
      )}
    </div>
  );
}

export function MetasQuantitativasList({ metas }: { metas: MetaQuantitativaView[] }) {
  const [sheetAberto, setSheetAberto] = useState(false);

  return (
    <div className="flex flex-col gap-2.5">
      {metas.length === 0 && (
        <p className="py-3 text-[13px] text-steel">Nenhuma meta quantitativa ainda.</p>
      )}

      {metas.map((meta) => (
        <LinhaMeta key={meta.id} meta={meta} />
      ))}

      <Button
        variant="dashed"
        size="sm"
        onClick={() => setSheetAberto(true)}
        className="mt-1.5 w-full"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
        Nova meta quantitativa
      </Button>

      <MetaQuantitativaSheet open={sheetAberto} onOpenChange={setSheetAberto} />
    </div>
  );
}
