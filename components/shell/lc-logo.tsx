import { cn } from "@/lib/utils";

/**
 * Logo oficial MYLIFE.
 *
 * Os PNGs em /public/brand são branco-transparente; aqui eles entram como
 * CSS `mask`, e a cor real vem de `currentColor`. Assim a logo herda o tema
 * (paper no dark, tinta no light) sem precisar de dois arquivos, do mesmo
 * jeito que o antigo SVG-text fazia.
 *
 * `compact` troca a wordmark completa pelo monograma "ML" — usado quando o
 * container não comporta a largura da wordmark (ex.: sidebar recolhida).
 * A proporção de cada arquivo é fixada via `aspect-ratio` para o `h-*`
 * escalar a largura corretamente.
 */
export function LcLogo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const src = compact ? "/brand/ml.png" : "/brand/mylife.png";
  // ratios reais dos arquivos processados (w/h)
  const ratio = compact ? 373 / 161 : 1049 / 138;

  return (
    <span
      role="img"
      aria-label="MYLIFE"
      className={cn("inline-block h-6 w-auto align-middle text-paper", className)}
      style={{
        aspectRatio: ratio,
        backgroundColor: "currentColor",
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}
