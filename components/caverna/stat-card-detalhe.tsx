"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { VariationBadge, type Polaridade } from "@/components/caverna/variation-badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { HomeCardConfig, HomeMetricKey, HomePeriodo } from "@/lib/data/home-metricas";

/** Uma linha do detalhamento: rótulo à esquerda, valor à direita, barra de proporção. */
export type LinhaDetalhe = {
  label: string;
  valor: string;
  /** cor do ponto e da barra de proporção */
  cor?: string;
  /** proporção 0–1 do valor no total (desenha a barra) */
  share?: number;
  /** valor secundário em cinza (ex.: "12%") */
  hint?: string;
};

export type MetricaOpcao = { value: HomeMetricKey; label: string };

export function StatCardDetalhe({
  label,
  value,
  pct,
  upIsBad,
  contexto = "vs mês anterior",
  descricao,
  grupos,
  total,
  verMais,
  acento = "var(--color-mint)",
  configuravel,
}: {
  label: string;
  value: string;
  pct?: number | null;
  upIsBad?: Polaridade;
  contexto?: string;
  /** texto abaixo do título no dialog */
  descricao: string;
  /** grupos de linhas; cada grupo com título opcional */
  grupos: { titulo?: string; linhas: LinhaDetalhe[] }[];
  /** linha-resumo em destaque no rodapé (ex.: total) */
  total?: { label: string; valor: string };
  /** link "ver módulo completo" no rodapé do dialog */
  verMais?: { href: string; label: string };
  /** cor de acento do hero (usada no glow do topo) */
  acento?: string;
  /** habilita o menu de "trocar métrica" no canto do card */
  configuravel?: {
    config: HomeCardConfig;
    opcoes: MetricaOpcao[];
    onChange: (config: HomeCardConfig) => void;
  };
}) {
  let rowIndex = 0;
  return (
    <Dialog>
      <div className="group relative">
        <DialogTrigger asChild>
          <button
            type="button"
            className="block w-full text-left outline-none rounded-[20px] focus-visible:ring-2 focus-visible:ring-mint/40"
          >
            <Card className="flex h-full flex-col gap-3 p-5 transition-all duration-200 group-hover:border-mint/30 group-hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <CardLabel>{label}</CardLabel>
                <div className="flex items-center gap-1">
                  {configuravel && <div className="h-7 w-7" aria-hidden />}
                  <ArrowUpRight
                    className="h-3.5 w-3.5 text-steel transition-colors group-hover:text-mint"
                    strokeWidth={1.5}
                  />
                </div>
              </div>
              <div className="tabular text-[clamp(18px,5.5vw,26px)] font-semibold leading-tight text-paper">
                {value}
              </div>
              <div className="mt-auto flex items-center gap-2 text-[12.5px] text-steel">
                {typeof pct === "number" && (
                  <VariationBadge pct={pct} upIsBad={upIsBad} />
                )}
                <span>{contexto}</span>
              </div>
            </Card>
          </button>
        </DialogTrigger>
        {configuravel && (
          <div className="absolute right-9 top-5 z-10">
            <ConfigMenu {...configuravel} />
          </div>
        )}
      </div>

      <DialogContent className="p-0 max-w-md overflow-hidden">
        {/* Hero */}
        <div className="relative overflow-hidden px-6 pt-6 pb-5">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full opacity-25 blur-3xl"
            style={{ background: acento }}
          />
          <div className="relative">
            <DialogTitle asChild>
              <CardLabel>{label}</CardLabel>
            </DialogTitle>
            <div className="tabular mt-3 flex flex-wrap items-end gap-2.5">
              <span className="display text-[clamp(24px,8vw,34px)] leading-none text-paper">
                {value}
              </span>
              {typeof pct === "number" && (
                <VariationBadge pct={pct} upIsBad={upIsBad} className="mb-0.5" />
              )}
            </div>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-mist">
              {descricao}
            </p>
          </div>
        </div>

        {/* Corpo */}
        <div className="border-t border-stroke bg-surface/40 px-6 py-5">
          <div className="flex flex-col gap-5">
            {grupos.map((g, gi) => (
              <div key={gi}>
                {g.titulo && (
                  <p className="microlabel mb-2.5 text-steel">{g.titulo}</p>
                )}
                <div className="flex flex-col gap-3">
                  {g.linhas.length === 0 ? (
                    <p className="text-[13px] text-steel">Nada por aqui ainda.</p>
                  ) : (
                    g.linhas.map((l, i) => (
                      <LinhaRow key={i} {...l} index={rowIndex++} />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

          {total && (
            <div className="mt-5 flex items-center justify-between border-t border-stroke pt-4">
              <span className="text-[13.5px] font-medium text-mist">
                {total.label}
              </span>
              <span className="tabular text-[17px] font-semibold text-paper">
                {total.valor}
              </span>
            </div>
          )}

          {verMais && (
            <Link
              href={verMais.href}
              className="mt-4 inline-flex items-center gap-1 text-[12.5px] text-mist transition-colors hover:text-mint"
            >
              {verMais.label}
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const PERIODO_OPCOES: { value: HomePeriodo; label: string }[] = [
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
  { value: "trimestre", label: "Trimestre" },
];

function ConfigMenu({
  config,
  opcoes,
  onChange,
}: {
  config: HomeCardConfig;
  opcoes: MetricaOpcao[];
  onChange: (config: HomeCardConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="flex h-7 w-7 items-center justify-center rounded-full text-steel opacity-0 transition-all hover:bg-surface-2 hover:text-mint focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100"
          aria-label="Configurar card"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-64"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="microlabel mb-3 text-steel">Configurar card</p>
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1.5 block text-[11.5px] text-steel">Métrica</label>
            <Select
              value={config.metrica}
              onValueChange={(v) =>
                startTransition(() => onChange({ ...config, metrica: v as HomeCardConfig["metrica"] }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {opcoes.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11.5px] text-steel">Período</label>
            <Select
              value={config.periodo}
              onValueChange={(v) =>
                startTransition(() => onChange({ ...config, periodo: v as HomePeriodo }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODO_OPCOES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LinhaRow({
  label,
  valor,
  cor = "var(--color-steel)",
  share,
  hint,
  index,
}: LinhaDetalhe & { index: number }) {
  const pct = Math.max(0, Math.min(1, share ?? 0)) * 100;
  return (
    <div
      className="row-in"
      style={{ animationDelay: `${80 + index * 45}ms` }}
    >
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
