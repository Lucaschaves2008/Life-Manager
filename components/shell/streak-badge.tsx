"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAcao } from "@/lib/acao-cliente";
import { Flame as FlameIcon, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Flame } from "@/components/caverna/flame";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { zerarMeuStreakHoje } from "@/app/actions/streak";

/**
 * Badge de streak sempre visível no topbar — o "lembrete" estilo Duolingo:
 * a pessoa vê o foguinho toda hora e não quer deixá-lo apagar.
 *
 * Usuário comum: clicar leva à Home (onde mora o card de hábitos).
 * Super admin: clicar abre um menu com "Zerar streak (teste)", que apaga só
 * as atividades de hoje e recalcula o foguinho — ferramenta para testar a
 * animação/celebração sem mexer no banco manualmente.
 */
export function StreakBadge({
  streak,
  recorde,
  cumpriuHoje,
  isSuperAdmin = false,
}: {
  streak: number;
  recorde: number;
  /** já bateu o mínimo hoje? muda a copy de urgência */
  cumpriuHoje: boolean;
  isSuperAdmin?: boolean;
}) {
  const lit = streak > 0;

  const title = lit
    ? cumpriuHoje
      ? `Ofensiva de ${streak} ${streak === 1 ? "dia" : "dias"} · mínimo LC batido hoje 🔥` +
        (recorde > streak ? ` · recorde ${recorde}` : "")
      : `Ofensiva de ${streak} ${
          streak === 1 ? "dia" : "dias"
        } · faça 1 treino ou o diário de dieta hoje para não apagar`
    : "Acenda seu foguinho: 1 treino ou diário de dieta hoje";

  const badgeInner = (
    <>
      <Flame streak={streak} size={22} />
      <span className={cnBadgeNumber(lit, cumpriuHoje)}>{streak}</span>
    </>
  );

  const badgeClass =
    "group flex items-center gap-1 rounded-full border border-stroke bg-surface-2/60 py-1 pl-1 pr-2.5 transition-colors hover:border-[var(--stroke-hover)]";

  // Usuário comum: badge é um simples atalho para a Home.
  if (!isSuperAdmin) {
    return (
      <Link href="/" title={title} aria-label={`Ofensiva de ${streak} dias`} className={badgeClass}>
        {badgeInner}
      </Link>
    );
  }

  // Admin: badge abre menu com a ferramenta de reset.
  return <AdminBadge title={title} className={badgeClass} streak={streak} inner={badgeInner} />;
}

function AdminBadge({
  title,
  className,
  streak,
  inner,
}: {
  title: string;
  className: string;
  streak: number;
  inner: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, executar] = useAcao();

  const zerar = () => {
    executar(async () => {
      try {
        const res = await zerarMeuStreakHoje();
        const n =
          res.apagados.treinos +
          res.apagados.corridas +
          res.apagados.diarios +
          res.apagados.checkins +
          res.apagados.estudos;
        // reseta o marcador de celebração p/ o foguinho poder "subir" de novo
        try {
          window.localStorage.removeItem("lc-streak-visto");
        } catch {
          /* noop */
        }
        toast.success("Streak zerado", {
          description:
            n > 0
              ? `Apaguei ${n} atividade(s) de hoje. Marque algo p/ ver o foguinho acender.`
              : "Nenhuma atividade hoje — o foguinho já estava em 0.",
        });
        router.refresh();
      } catch (e) {
        toast.error("Não deu para zerar", {
          description: e instanceof Error ? e.message : "Erro inesperado.",
        });
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" title={title} aria-label={`Ofensiva de ${streak} dias`} className={className}>
          {inner}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="flex items-center gap-2">
          <FlameIcon className="h-3.5 w-3.5 text-amber" strokeWidth={2} />
          Ofensiva · {streak} {streak === 1 ? "dia" : "dias"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/">Ver na Home</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            zerar();
          }}
          disabled={pending}
        >
          <RotateCcw className="h-4 w-4 text-steel" strokeWidth={1.5} />
          {pending ? "Zerando…" : "Zerar streak (teste)"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function cnBadgeNumber(lit: boolean, cumpriuHoje: boolean) {
  const base = "tabular text-[13px] font-semibold leading-none";
  // hoje ainda pendente e streak vivo → número âmbar puxa a atenção
  if (lit && !cumpriuHoje) return `${base} text-amber`;
  if (lit) return `${base} text-ice`;
  return `${base} text-steel`;
}
