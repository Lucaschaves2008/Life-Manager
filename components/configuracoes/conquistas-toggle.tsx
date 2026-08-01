"use client";

import { useState } from "react";
import { useAcao } from "@/lib/acao-cliente";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { saveSettings } from "@/app/actions/settings";
import { PREF_CONQUISTAS } from "@/lib/conquistas";

/**
 * Liga/desliga o toast de conquista (meta batida, checklist 100%, marco de
 * streak, dieta cumprida). Ligado por padrão — grava "off" para desativar.
 */
export function ConquistasToggle({ ativo }: { ativo: boolean }) {
  const [checked, setChecked] = useState(ativo);
  const [pending, executar] = useAcao();

  function alternar(valor: boolean) {
    const anterior = checked;
    setChecked(valor); // otimista
    executar(async () => {
      try {
        await saveSettings({ [PREF_CONQUISTAS]: valor ? "on" : "off" });
      } catch {
        setChecked(anterior);
        toast.error("Não foi possível salvar a preferência.");
      }
    });
  }

  return (
    <label className="flex cursor-pointer items-start gap-3 py-1">
      <Checkbox
        className="mt-0.5"
        checked={checked}
        onCheckedChange={(v) => alternar(v === true)}
        disabled={pending}
        aria-label="Comemorar conquistas"
      />
      <span className="min-w-0">
        <span className="block text-[13.5px] text-ice">Comemorar conquistas</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-steel">
          Mostra um aviso discreto quando você bate uma meta, fecha o checklist
          do dia ou cruza um marco de ofensiva.
        </span>
      </span>
    </label>
  );
}
