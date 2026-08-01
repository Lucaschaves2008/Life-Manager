"use client";

import { useMemo, useState } from "react";
import { NotebookPen, Pencil, Search, X } from "lucide-react";
import { NotaSessao } from "@/components/estudos/nota-sessao";
import { formatHoras } from "@/lib/data/estudos-format";
import type { SessaoResumo } from "@/lib/data/estudos";

const PAGINA = 8;

function carimbo(iso: string): string {
  const d = new Date(iso);
  const data = d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
  const hora = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  return `${data} · ${hora}`;
}

/** Todas as notas do tópico, da mais recente para a mais antiga, com busca. */
export function CadernoTopico({ notas }: { notas: SessaoResumo[] }) {
  const [busca, setBusca] = useState("");
  const [visiveis, setVisiveis] = useState(PAGINA);
  const [editando, setEditando] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return notas;
    return notas.filter(
      (n) =>
        n.notes?.toLowerCase().includes(q) || n.subject.toLowerCase().includes(q)
    );
  }, [notas, busca]);

  const mostradas = filtradas.slice(0, visiveis);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-steel"
          strokeWidth={1.5}
        />
        <input
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setVisiveis(PAGINA);
          }}
          placeholder="Buscar nas notas…"
          className="h-10 w-full rounded-[14px] border border-stroke bg-surface-2 pl-10 pr-9 text-[13.5px] text-ice outline-none transition-colors focus:border-[rgba(13,110,253,.4)] placeholder:text-steel"
        />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca("")}
            aria-label="Limpar busca"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-steel transition-colors hover:text-ice"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}
      </div>

      {filtradas.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-steel">
          Nenhuma nota encontrada.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {mostradas.map((n) => (
            <article
              key={n.id}
              className="rounded-[14px] border border-stroke bg-surface-2 p-4"
            >
              <div className="mb-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="tabular text-[11.5px] text-steel">
                  {carimbo(n.startedAt)}
                </span>
                <span className="text-steel">·</span>
                <span className="text-[12.5px] text-mist">{n.subject}</span>
                <span className="tabular ml-auto text-[11.5px] text-steel">
                  {formatHoras(n.liquidoSec)}
                </span>
                <button
                  type="button"
                  onClick={() => setEditando(editando === n.id ? null : n.id)}
                  aria-label="Editar nota"
                  className="text-steel transition-colors hover:text-mint"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
              {editando === n.id ? (
                <NotaSessao
                  sessionId={n.id}
                  notaInicial={n.notes}
                  label="Editando"
                  linhas={6}
                />
              ) : (
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ice">
                  {n.notes}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {visiveis < filtradas.length && (
        <button
          type="button"
          onClick={() => setVisiveis((v) => v + PAGINA)}
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-stroke px-4 py-2 text-[12.5px] text-mist transition-colors hover:border-[rgba(143,169,205,.22)] hover:text-ice"
        >
          <NotebookPen className="h-3.5 w-3.5" strokeWidth={1.5} />
          Mostrar mais ({filtradas.length - visiveis})
        </button>
      )}
    </div>
  );
}
