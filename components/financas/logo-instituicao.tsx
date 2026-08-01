"use client";

import { useState } from "react";
import { instituicaoPorSlug } from "@/lib/instituicoes-financeiras";
import { cn } from "@/lib/utils";

/**
 * Logo do banco/instituição, com fallback para um círculo colorido com a
 * inicial enquanto o arquivo em public/brand/bancos/ não existir (ou falhar
 * ao carregar) — nunca quebra o layout, só degrada visualmente.
 */
export function LogoInstituicao({
  instituicao,
  nomeFallback,
  size = 28,
  className,
}: {
  instituicao: string | null | undefined;
  /** Usado para a inicial quando não há instituição mapeada (ex.: card.nome). */
  nomeFallback?: string;
  size?: number;
  className?: string;
}) {
  const info = instituicaoPorSlug(instituicao);
  const [erro, setErro] = useState(false);

  if (info && !erro) {
    return (
      <span
        className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/5", className)}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={info.arquivo}
          alt={info.nome}
          width={size}
          height={size}
          className="h-full w-full object-contain p-0.5"
          onError={() => setErro(true)}
        />
      </span>
    );
  }

  const inicial = (info?.nome ?? nomeFallback ?? "?").trim().charAt(0).toUpperCase();
  const cor = info?.cor ?? "var(--color-navy)";

  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white", className)}
      style={{ width: size, height: size, backgroundColor: cor }}
    >
      {inicial}
    </span>
  );
}
