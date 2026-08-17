"use client";

import { Check, X, type LucideIcon } from "lucide-react";

/**
 * Tela cheia que aparece ao apertar "Treinar" — escolha entre marcar como
 * feito na hora (rápido, sem abrir nada) ou seguir pro fluxo detalhado
 * (cronômetro na musculação, registro com distância/tempo na corrida). Mesmo
 * tratamento visual do fixed inset-0 bg-bg que o ExecucaoTreino já usa.
 */
export function TreinoChooser({
  aberto,
  onOpenChange,
  titulo,
  subtitulo,
  marcando,
  onMarcarFeito,
  opcaoSecundaria,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  titulo: string;
  subtitulo?: string;
  marcando: boolean;
  onMarcarFeito: () => void;
  opcaoSecundaria: { label: string; icon: LucideIcon; onSelect: () => void };
}) {
  if (!aberto) return null;
  const IconeSecundaria = opcaoSecundaria.icon;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="flex shrink-0 items-center justify-end px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          onClick={() => onOpenChange(false)}
          aria-label="Fechar"
          className="rounded-full p-2 text-steel transition-colors hover:bg-surface-2 hover:text-ice"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-9 px-6 text-center">
        <div>
          <p className="text-[19px] text-paper">{titulo}</p>
          {subtitulo && <p className="mt-1.5 text-[13px] text-steel">{subtitulo}</p>}
        </div>

        <div className="flex w-full max-w-[340px] flex-col gap-3">
          <button
            onClick={onMarcarFeito}
            disabled={marcando}
            className="flex min-h-[var(--tap-capture-primary)] w-full items-center justify-center gap-2 rounded-[var(--radius-inner)] bg-mint text-[15px] font-medium text-[var(--color-bg)] transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            <Check className="h-5 w-5" strokeWidth={2.5} />
            {marcando ? "Marcando…" : "Marcar como feito"}
          </button>
          <button
            onClick={opcaoSecundaria.onSelect}
            disabled={marcando}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-inner)] border border-stroke text-[14px] text-ice transition-colors hover:bg-surface-2 disabled:opacity-60"
          >
            <IconeSecundaria className="h-4 w-4" strokeWidth={1.5} />
            {opcaoSecundaria.label}
          </button>
        </div>
      </div>
    </div>
  );
}
