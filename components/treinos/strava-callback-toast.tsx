"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

/** Mostra o resultado do redirect OAuth do Strava (?strava=ok | ?erro=...) e limpa a URL. */
export function StravaCallbackToast() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const ok = params.get("strava");
    const erro = params.get("erro");
    if (!ok && !erro) return;

    if (ok === "ok") toast.success("Strava conectado com sucesso");
    if (erro) toast.error(erro);

    const next = new URLSearchParams(params.toString());
    next.delete("strava");
    next.delete("erro");
    router.replace(`/treinos?${next.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
