import { cn } from "@/lib/utils";

/**
 * Lista de contas/ativos (3.5.4): avatar quadrado arredondado colorido
 * + nome + subtítulo + valor à direita em tabular-nums + rodapé discreto.
 */
export function EntityRow({
  cor,
  inicial,
  emoji,
  nome,
  subtitulo,
  direita,
  subDireita,
  className,
}: {
  cor: string;
  inicial?: string;
  emoji?: string;
  nome: string;
  subtitulo?: string;
  direita?: React.ReactNode;
  subDireita?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-stroke py-3 last:border-0",
        className
      )}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[14px] font-semibold"
        style={{
          background: `color-mix(in srgb, ${cor} 16%, transparent)`,
          color: cor,
        }}
      >
        {emoji ?? inicial?.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] text-ice">{nome}</p>
        {subtitulo && (
          <p className="truncate text-[11.5px] text-steel">{subtitulo}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        {direita && (
          <div className="tabular text-[14px] font-medium text-paper">
            {direita}
          </div>
        )}
        {subDireita && (
          <div className="text-[11.5px] text-steel">{subDireita}</div>
        )}
      </div>
    </div>
  );
}

/** Rodapé discreto da lista: "2 contas". */
export function EntityListFooter({ children }: { children: React.ReactNode }) {
  return <p className="pt-2.5 text-[11.5px] text-steel">{children}</p>;
}
