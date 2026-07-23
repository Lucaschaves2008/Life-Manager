"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

export function CodigoConvite({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    await navigator.clipboard.writeText(codigo);
    setCopiado(true);
    toast.success("Código copiado");
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <button
      onClick={copiar}
      className="group flex items-center gap-2 rounded-full border border-stroke bg-surface-2 px-3 py-1 text-[13px] tracking-[0.1em] text-ice transition-colors hover:border-[rgba(13,110,253,.4)]"
    >
      <span className="tabular">{codigo}</span>
      {copiado ? (
        <Check className="h-3.5 w-3.5 text-mint" strokeWidth={1.5} />
      ) : (
        <Copy className="h-3.5 w-3.5 text-steel group-hover:text-ice" strokeWidth={1.5} />
      )}
    </button>
  );
}
