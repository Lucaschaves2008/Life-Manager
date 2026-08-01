"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Check, Flame, Target, UtensilsCrossed } from "lucide-react";
import type { Conquista, ConquistaTipo } from "@/lib/conquistas";
import { cn } from "@/lib/utils";

const ICONE: Record<ConquistaTipo, typeof Check> = {
  meta_batida: Target,
  checklist_completo: Check,
  streak_marco: Flame,
  dieta_completa: UtensilsCrossed,
};

// Verde = conquista (polaridade semântica do app: verde é positivo/meta
// batida). Streak usa âmbar porque a chama já é âmbar no resto do shell.
const ACENTO: Record<ConquistaTipo, string> = {
  meta_batida: "var(--color-mint)",
  checklist_completo: "var(--color-mint)",
  streak_marco: "var(--cal-amber)",
  dieta_completa: "var(--color-mint)",
};

/** Chaves já comemoradas nesta aba — evita repetir ao re-renderizar/navegar. */
const jaMostradas = new Set<string>();

/** Conteúdo visual do toast de conquista (usado dentro do sonner). */
function ConquistaCard({ conquista }: { conquista: Conquista }) {
  const Icon = ICONE[conquista.tipo];
  const acento = ACENTO[conquista.tipo];

  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full",
          "animate-[conquista-pop_420ms_cubic-bezier(0.16,1,0.3,1)]"
        )}
        style={{
          background: `color-mix(in srgb, ${acento} 16%, transparent)`,
          border: `1px solid color-mix(in srgb, ${acento} 45%, transparent)`,
        }}
        aria-hidden
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} style={{ color: acento }} />
      </span>
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-paper">{conquista.titulo}</p>
        <p className="text-[12.5px] leading-snug text-mist">{conquista.detalhe}</p>
      </div>
    </div>
  );
}

/** Dispara o toast de uma conquista (no-op se já mostrada nesta aba). */
export function mostrarConquista(conquista: Conquista) {
  if (jaMostradas.has(conquista.chave)) return;
  jaMostradas.add(conquista.chave);
  toast.custom(() => <ConquistaCard conquista={conquista} />, {
    duration: 4200,
  });
}

/**
 * Monta-se no shell e comemora as conquistas que o servidor detectou nesta
 * renderização. `habilitado` vem da preferência do usuário (Setting) — quando
 * off, nada é disparado.
 */
export function ConquistasWatcher({
  conquistas,
  habilitado,
}: {
  conquistas: Conquista[];
  habilitado: boolean;
}) {
  // guarda o valor mais recente sem re-disparar o efeito por identidade do array
  const ref = useRef(conquistas);
  ref.current = conquistas;

  useEffect(() => {
    if (!habilitado) return;
    for (const c of ref.current) mostrarConquista(c);
  }, [habilitado, conquistas]);

  return null;
}
