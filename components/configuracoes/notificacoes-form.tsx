"use client";

import { useState } from "react";
import { useAcao } from "@/lib/acao-cliente";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { saveSettings } from "@/app/actions/settings";
import {
  TIPOS_NOTIFICACAO,
  chaveNotificacao,
  type CanalNotificacao,
} from "@/lib/preferencias";

/**
 * Escolha do que receber e por qual canal. Desligado por padrão (opt-in).
 *
 * O ENVIO ainda não existe — não há job de e-mail nem push registrado. Isso
 * fica explícito na UI: gravar preferência de algo que não é enviado seria
 * prometer o que o app não cumpre.
 */
export function NotificacoesForm({
  valores,
}: {
  valores: Record<string, boolean>;
}) {
  const [estado, setEstado] = useState(valores);
  const [pending, executar] = useAcao();

  function alternar(chave: string, valor: boolean) {
    const anterior = estado[chave] ?? false;
    setEstado((e) => ({ ...e, [chave]: valor }));
    executar(async () => {
      try {
        await saveSettings({ [chave]: valor ? "on" : "off" });
      } catch {
        setEstado((e) => ({ ...e, [chave]: anterior }));
        toast.error("Não foi possível salvar a preferência.");
      }
    });
  }

  const canais: { value: CanalNotificacao; label: string }[] = [
    { value: "email", label: "E-mail" },
    { value: "push", label: "Push" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden sm:grid sm:grid-cols-[1fr_auto] sm:items-end sm:gap-6">
        <span />
        <div className="grid grid-cols-2 gap-6 text-center">
          {canais.map((c) => (
            <span key={c.value} className="microlabel w-14 text-steel">
              {c.label}
            </span>
          ))}
        </div>
      </div>

      {TIPOS_NOTIFICACAO.map((tipo) => (
        <div
          key={tipo.value}
          className="flex flex-col gap-2.5 border-b border-stroke pb-4 last:border-0 last:pb-0 sm:grid sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6"
        >
          <div className="min-w-0">
            <p className="text-[13.5px] text-ice">{tipo.label}</p>
            <p className="text-[12px] leading-relaxed text-steel">{tipo.ajuda}</p>
          </div>
          <div className="flex gap-6 sm:grid sm:grid-cols-2 sm:justify-items-center">
            {canais.map((canal) => {
              const chave = chaveNotificacao(tipo.value, canal.value);
              return (
                <label
                  key={canal.value}
                  className="flex w-14 cursor-pointer items-center justify-center gap-2 sm:justify-center"
                >
                  <Checkbox
                    checked={estado[chave] ?? false}
                    onCheckedChange={(v) => alternar(chave, v === true)}
                    disabled={pending}
                    aria-label={`${tipo.label} por ${canal.label}`}
                  />
                  <span className="text-[12px] text-mist sm:hidden">{canal.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <p className="rounded-[10px] border border-stroke bg-surface-2 px-3.5 py-2.5 text-[12px] leading-relaxed text-steel">
        Suas escolhas ficam salvas, mas os envios ainda não estão ativos — o
        disparo de e-mail e push entra numa próxima etapa.
      </p>
    </div>
  );
}
