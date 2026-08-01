"use client";

import { useState } from "react";
import { useAcao } from "@/lib/acao-cliente";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lancarDinheiro } from "@/app/actions/dinheiro-lancamentos";

/**
 * Lançamento inline de dinheiro ganho — alimenta a métrica "dinheiro" global
 * (DinheiroLancamento), usada por qualquer MetaQuantitativa ou DesafioMeta.
 * Um único lançamento reflete em todas as metas/desafios com essa métrica.
 */
export function LancarDinheiro({ hoje, className }: { hoje: string; className?: string }) {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState("");
  const [pending, executar] = useAcao();

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className={`text-[11.5px] text-mint hover:underline ${className ?? ""}`}
      >
        + Lançar dinheiro ganho
      </button>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Input
        autoFocus
        inputMode="decimal"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onFocus={(e) => e.target.select()}
        placeholder="Ex.: 500"
        className="h-8 w-28 text-[12.5px] tabular"
      />
      <Button
        size="sm"
        variant="primary"
        disabled={!Number(valor.replace(",", ".")) || pending}
        onClick={() =>
          executar(async () => {
            await lancarDinheiro({ valor: Number(valor.replace(",", ".")), data: hoje });
            toast.success("Dinheiro lançado");
            setValor("");
            setAberto(false);
          })
        }
      >
        Lançar
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>
        Cancelar
      </Button>
    </div>
  );
}
