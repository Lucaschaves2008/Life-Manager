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
  | "natacoes_completas"
  | "metros_nadados"
  | "pedaladas_completas"
  | "km_pedalados"
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
    value: "natacoes_completas",
    label: "Natações completas",
    unidade: "natações",
    placeholder: "Ex.: 12",
  },
  { value: "metros_nadados", label: "Metros nadados", unidade: "m", placeholder: "Ex.: 20000" },
  {
    value: "pedaladas_completas",
    label: "Pedaladas completas",
    unidade: "pedaladas",
    placeholder: "Ex.: 10",
  },
  { value: "km_pedalados", label: "Km pedalados", unidade: "km", placeholder: "Ex.: 300" },
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
  /** sessões de cardio no período, por modalidade */
  corridas: number;
  natacoes: number;
  pedaladas: number;
  /** distância no período em KM (a natação vira metros na fórmula) */
  km: number;
  kmNatacao: number;
  kmCiclismo: number;
  refeicoesCumpridas: number;
  segundosEstudo: number;
  /** soma dos lançamentos em CENTAVOS — convertida para reais aqui dentro */
  dinheiroCentavos: number;
};

/** Registros zerados — base para preencher só o que a métrica pedida usa. */
export const REGISTROS_VAZIOS: RegistrosDoPeriodo = {
  treinos: 0,
  corridas: 0,
  natacoes: 0,
  pedaladas: 0,
  km: 0,
  kmNatacao: 0,
  kmCiclismo: 0,
  refeicoesCumpridas: 0,
  segundosEstudo: 0,
  dinheiroCentavos: 0,
};

/**
 * Bucketiza uma lista de sessões de cardio por modalidade, numa passada. Puro —
 * quem chama já filtrou pelo período. Fica aqui (e não no módulo com I/O) para
 * metas e desafios contarem exatamente do mesmo jeito.
 */
export function contarCardio(
  sessoes: { modalidade: string }[]
): Pick<RegistrosDoPeriodo, "corridas" | "natacoes" | "pedaladas"> {
  const conta = { corridas: 0, natacoes: 0, pedaladas: 0 };
  for (const s of sessoes) {
    if (s.modalidade === "natacao") conta.natacoes++;
    else if (s.modalidade === "ciclismo") conta.pedaladas++;
    else conta.corridas++; // default histórico: linha sem modalidade é corrida
  }
  return conta;
}

export function calcularMetrica(
  metrica: MetaMetrica,
  registros: RegistrosDoPeriodo
): number {
  switch (metrica) {
    case "treinos":
      // Qualquer treino conta: musculação + as três modalidades de cardio.
      return (
        registros.treinos + registros.corridas + registros.natacoes + registros.pedaladas
      );
    case "corridas_completas":
      return registros.corridas;
    case "km_corridos":
      return registros.km;
    case "natacoes_completas":
      return registros.natacoes;
    case "metros_nadados":
      // Natação é armazenada em km, como as outras; a meta fala em metros.
      return registros.kmNatacao * 1000;
    case "pedaladas_completas":
      return registros.pedaladas;
    case "km_pedalados":
      return registros.kmCiclismo;
    case "refeicoes_cumpridas":
      return registros.refeicoesCumpridas;
    case "horas_estudo":
      return registros.segundosEstudo / 3600;
    case "dinheiro":
      return registros.dinheiroCentavos / 100;
  }
}
