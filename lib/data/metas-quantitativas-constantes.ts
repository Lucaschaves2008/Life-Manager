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
  | "horas_estudo"
  | "dinheiro";

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
  { value: "dinheiro", label: "Dinheiro ganho", unidade: "R$", placeholder: "Ex.: 10000" },
];

export const PERIODOS: { value: MetaPeriodo; label: string }[] = [
  { value: "mes", label: "Este mês" },
  { value: "trimestre", label: "Este trimestre" },
  { value: "ano", label: "Este ano" },
];

/**
 * FONTE ÚNICA das fórmulas de cada métrica, em memória e sem I/O.
 *
 * Existem dois caminhos que precisam do MESMO número: metas-quantitativas.ts
 * (queries diretas por usuário) e desafios.ts (uma leva de queries para todos
 * os membros, filtrada em memória p/ evitar N+1). Antes cada um reimplementava
 * as 6 fórmulas; batiam por coincidência, e qualquer ajuste em um lado não
 * chegava no outro. Agora ambos convertem seus dados para `RegistrosDoPeriodo`
 * e chamam `calcularMetrica`, então a regra de negócio vive num lugar só.
 *
 * Cada lista deve conter apenas registros JÁ filtrados para o período.
 */
export type RegistrosDoPeriodo = {
  treinos: number;
  corridas: number;
  km: number;
  refeicoesCumpridas: number;
  segundosEstudo: number;
  /** soma dos lançamentos em CENTAVOS — convertida para reais aqui dentro */
  dinheiroCentavos: number;
};

export function calcularMetrica(
  metrica: MetaMetrica,
  registros: RegistrosDoPeriodo
): number {
  switch (metrica) {
    case "treinos":
      return registros.treinos + registros.corridas;
    case "corridas_completas":
      return registros.corridas;
    case "km_corridos":
      return registros.km;
    case "refeicoes_cumpridas":
      return registros.refeicoesCumpridas;
    case "horas_estudo":
      return registros.segundosEstudo / 3600;
    case "dinheiro":
      return registros.dinheiroCentavos / 100;
  }
}
