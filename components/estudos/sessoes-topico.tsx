"use client";

import { useState } from "react";
import { ChevronDown, NotebookPen } from "lucide-react";
import { formatHoras } from "@/lib/data/estudos-format";
import type { SessaoResumo } from "@/lib/data/estudos";

const PAGINA = 15;

function dia(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

/** Histórico completo de sessões do tópico, da mais recente para a mais antiga. */
export function SessoesTopico({ sessoes }: { sessoes: SessaoResumo[] }) {
  const [visiveis, setVisiveis] = useState(PAGINA);

  return (
    <div className="flex flex-col">
      {sessoes.slice(0, visiveis).map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-3 border-b border-stroke py-2.5 last:border-0"
        >
          <span className="tabular w-[62px] shrink-0 text-[12px] text-steel">
            {dia(s.startedAt)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-ice">
              {s.subject}
              {s.emAndamento && (
                <span className="ml-2 text-[11px] text-mint">em andamento</span>
              )}
            </p>
            <p className="tabular text-[11px] text-steel">
              {hhmm(s.startedAt)}
              {s.endedAt ? `–${hhmm(s.endedAt)}` : ""}
              {s.pausadoSec > 0 && ` · ${formatHoras(s.pausadoSec)} de pausa`}
            </p>
          </div>
          {!!s.notes?.trim() && (
            <NotebookPen
              className="h-3.5 w-3.5 shrink-0 text-steel"
              strokeWidth={1.5}
              aria-label="tem nota"
            />
          )}
          <span className="tabular shrink-0 text-[13px] text-mist">
            {formatHoras(s.liquidoSec)}
          </span>
        </div>
      ))}

      {visiveis < sessoes.length && (
        <button
          type="button"
          onClick={() => setVisiveis((v) => v + PAGINA)}
          className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-stroke px-4 py-2 text-[12.5px] text-mist transition-colors hover:border-[rgba(143,169,205,.22)] hover:text-ice"
        >
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} />
          Mostrar mais ({sessoes.length - visiveis})
        </button>
      )}
    </div>
  );
}
