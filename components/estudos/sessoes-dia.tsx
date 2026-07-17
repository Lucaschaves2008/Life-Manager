"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Coffee, Pencil, Trash2 } from "lucide-react";
import {
  excluirSessao,
  renomearPausa,
  renomearSessao,
} from "@/app/actions/estudos";
import { formatHoras, type PausaView, type SessaoView } from "@/lib/data/estudos";
import { cn } from "@/lib/utils";

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function PausaLinha({ pausa }: { pausa: PausaView }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [valor, setValor] = useState(pausa.label ?? "");
  const [editando, setEditando] = useState(false);

  const salvar = () => {
    setEditando(false);
    if ((pausa.label ?? "") === valor.trim()) return;
    startTransition(async () => {
      await renomearPausa(pausa.id, valor);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-3 py-1.5">
      <Coffee className="h-3.5 w-3.5 shrink-0 text-steel" strokeWidth={1.5} />
      {editando ? (
        <input
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={salvar}
          onKeyDown={(e) => {
            if (e.key === "Enter") salvar();
            if (e.key === "Escape") setEditando(false);
          }}
          placeholder="almoço, descanso…"
          className="h-7 flex-1 rounded-[10px] border border-stroke bg-surface-2 px-2.5 text-[12.5px] text-ice outline-none focus:border-[rgba(13,110,253,.4)]"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="group flex flex-1 items-center gap-2 text-left"
        >
          <span
            className={cn(
              "text-[12.5px]",
              pausa.label ? "text-ice" : "text-steel italic"
            )}
          >
            {pausa.label || "sem rótulo"}
          </span>
          <Pencil
            className="h-3 w-3 text-steel opacity-0 transition-opacity group-hover:opacity-100"
            strokeWidth={1.5}
          />
        </button>
      )}
      <span className="tabular shrink-0 text-[12px] text-mist">
        {formatHoras(pausa.durationSec)}
      </span>
    </div>
  );
}

function SessaoCard({ sessao }: { sessao: SessaoView }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [, startTransition] = useTransition();
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [titulo, setTitulo] = useState(sessao.subject);

  const salvarTitulo = () => {
    setEditandoTitulo(false);
    if (titulo.trim() === sessao.subject) return;
    startTransition(async () => {
      await renomearSessao(sessao.id, titulo);
      router.refresh();
    });
  };

  const excluir = () => {
    startTransition(async () => {
      await excluirSessao(sessao.id);
      router.refresh();
    });
  };

  return (
    <div className="rounded-[14px] border border-stroke bg-surface-2">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-steel transition-transform",
              aberto && "rotate-180"
            )}
            strokeWidth={1.5}
          />
          <div className="min-w-0 flex-1">
            {editandoTitulo ? (
              <input
                autoFocus
                value={titulo}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setTitulo(e.target.value)}
                onBlur={salvarTitulo}
                onKeyDown={(e) => {
                  if (e.key === "Enter") salvarTitulo();
                  if (e.key === "Escape") setEditandoTitulo(false);
                }}
                className="h-7 w-full rounded-[10px] border border-stroke bg-surface px-2.5 text-[13.5px] text-ice outline-none focus:border-[rgba(13,110,253,.4)]"
              />
            ) : (
              <p className="truncate text-[13.5px] text-ice">{sessao.subject}</p>
            )}
            <p className="tabular text-[11.5px] text-steel">
              {hhmm(sessao.startedAt)}
              {sessao.endedAt ? `–${hhmm(sessao.endedAt)}` : ""} ·{" "}
              {sessao.pausas.length}{" "}
              {sessao.pausas.length === 1 ? "parada" : "paradas"}
            </p>
          </div>
        </button>
        <div className="shrink-0 text-right">
          <p className="tabular text-[15px] font-semibold text-paper">
            {formatHoras(sessao.liquidoSec)}
          </p>
          <p className="text-[11px] text-steel">líquido</p>
        </div>
      </div>

      {aberto && (
        <div className="border-t border-stroke px-4 py-3">
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="tabular text-[13px] text-ice">
                {formatHoras(sessao.brutoSec)}
              </p>
              <p className="text-[10.5px] uppercase tracking-wide text-steel">
                Bruto
              </p>
            </div>
            <div>
              <p className="tabular text-[13px] text-ice">
                {formatHoras(sessao.liquidoSec)}
              </p>
              <p className="text-[10.5px] uppercase tracking-wide text-steel">
                Líquido
              </p>
            </div>
            <div>
              <p className="tabular text-[13px] text-ice">
                {formatHoras(sessao.pausadoSec)}
              </p>
              <p className="text-[10.5px] uppercase tracking-wide text-steel">
                Descanso
              </p>
            </div>
          </div>

          {sessao.pausas.length > 0 && (
            <div className="border-t border-stroke pt-2">
              <p className="microlabel mb-1">
                Paradas · toque para renomear
              </p>
              {sessao.pausas.map((p) => (
                <PausaLinha key={p.id} pausa={p} />
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-stroke pt-3">
            <button
              type="button"
              onClick={() => setEditandoTitulo(true)}
              className="inline-flex items-center gap-1.5 text-[12px] text-mist transition-colors hover:text-mint"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
              Renomear
            </button>
            <button
              type="button"
              onClick={excluir}
              className="inline-flex items-center gap-1.5 text-[12px] text-steel transition-colors hover:text-coral"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SessoesDoDia({ sessoes }: { sessoes: SessaoView[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {sessoes.map((s) => (
        <SessaoCard key={s.id} sessao={s} />
      ))}
    </div>
  );
}
