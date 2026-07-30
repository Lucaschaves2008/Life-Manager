/**
 * Constantes e tipos puros de metas quantitativas (sem I/O), separados de
 * metas-quantitativas.ts para poderem ser importados por Client Components
 * sem arrastar dependências server-only (ex.: lib/data/variaveis.ts, que usa
 * "use cache" e não pode entrar no bundle do cliente).
 */

export type MetaMetrica =
  | "treinos"
  | "corridas_completas"
  | "km_corridos"
  | "refeicoes_cumpridas"
  | "horas_estudo";

export type MetaPeriodo = "mes" | "trimestre" | "ano";

export type MetaOrigem = "metrica" | "variavel";

export const METRICAS: {
  value: MetaMetrica;
  label: string;
  unidade: string;
  placeholder: string;
}[] = [
  { value: "treinos", label: "Treinos concluídos", unidade: "treinos", placeholder: "Ex.: 75" },
  {
    value: "corridas_completas",
    label: "Corridas completas",
    unidade: "corridas",
    placeholder: "Ex.: 20",
  },
  { value: "km_corridos", label: "Km corridos", unidade: "km", placeholder: "Ex.: 150" },
  {
    value: "refeicoes_cumpridas",
    label: "Refeições cumpridas",
    unidade: "refeições",
    placeholder: "Ex.: 50",
  },
  { value: "horas_estudo", label: "Horas de estudo", unidade: "horas", placeholder: "Ex.: 40" },
];

export const PERIODOS: { value: MetaPeriodo; label: string }[] = [
  { value: "mes", label: "Este mês" },
  { value: "trimestre", label: "Este trimestre" },
  { value: "ano", label: "Este ano" },
];
