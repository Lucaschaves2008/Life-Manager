import { LcLogo } from "@/components/shell/lc-logo";

const MODULOS = ["Finanças", "Investimentos", "Dieta", "Treinos", "Agenda"];

/** Coluna de marca das telas de login/cadastro — grade sutil, sem efeito de cor. */
export function PainelMarca() {
  return (
    <div className="relative hidden flex-1 overflow-hidden border-l border-stroke bg-bg lg:flex lg:items-center lg:p-16 xl:p-20">
      <svg className="absolute inset-0 h-full w-full opacity-[0.07]" aria-hidden="true">
        <defs>
          <pattern id="grade-marca" width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M 44 0 L 0 0 0 44" fill="none" stroke="var(--color-ice)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grade-marca)" />
      </svg>

      <div className="relative max-w-[460px]">
        <LcLogo className="h-8 text-paper" />
        <p className="display mt-8 text-[34px] leading-[1.15] tracking-[-0.02em] text-paper xl:text-[38px]">
          Finanças, saúde e rotina em um único painel.
        </p>
        <p className="mt-5 max-w-[400px] text-[14px] leading-relaxed text-mist">
          Acompanhe cartões, investimentos, dieta, treinos e agenda com uma
          visão clara e centralizada do seu dia a dia.
        </p>
        <ul className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] uppercase tracking-[0.14em] text-steel">
          {MODULOS.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
