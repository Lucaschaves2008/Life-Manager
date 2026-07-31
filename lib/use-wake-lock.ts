"use client";

import { useEffect, useRef } from "react";

/**
 * Mantém a tela acesa enquanto `ativo` for true (sessão de treino em
 * andamento). Sem isso a tela apaga entre séries e o usuário desbloqueia o
 * celular dezenas de vezes por treino — é o detalhe que separa app usado de
 * app instalado. Silencioso em navegadores sem suporte (Safari < 16.4,
 * contexto não-seguro) — a sessão continua funcionando, só sem o wake lock.
 * Reconquista o lock automaticamente ao voltar de background (o browser
 * libera o lock quando a aba perde visibilidade).
 */
export function useWakeLock(ativo: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!ativo || !("wakeLock" in navigator)) return;

    let cancelado = false;

    async function pedir() {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelado) {
          lock.release();
          return;
        }
        lockRef.current = lock;
      } catch {
        // permissão negada / tab oculta no momento do pedido — silencioso
      }
    }

    function onVisibilidade() {
      if (document.visibilityState === "visible" && !lockRef.current) {
        pedir();
      }
    }

    pedir();
    document.addEventListener("visibilitychange", onVisibilidade);

    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", onVisibilidade);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [ativo]);
}
