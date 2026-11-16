import { LcLogo } from "@/components/shell/lc-logo";

const MODULOS = ["Finanças", "Investimentos", "Dieta", "Treinos", "Agenda"];

/** Coluna de marca das telas de login/cadastro — só tipografia, sem efeito de cor. */
export function PainelMarca() {
  return (
    <div className="relative hidden flex-1 border-l border-stroke bg-surface lg:flex lg:flex-col lg:justify-between lg:p-16 xl:p-20">
      <LcLogo className="h-6 text-paper" />

      <div className="max-w-[440px]">
        <p className="display text-[34px] leading-[1.15] tracking-[-0.02em] text-paper xl:text-[38px]">
          Finanças, saúde e rotina em um único painel.
        </p>
        <p className="mt-5 max-w-[380px] text-[14px] leading-relaxed text-mist">
          Acompanhe cartões, investimentos, dieta, treinos e agenda com uma
          visão clara e centralizada do seu dia a dia.
        </p>
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] uppercase tracking-[0.14em] text-steel">
        {MODULOS.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}
