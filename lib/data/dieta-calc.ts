/**
 * Validação de coerência kcal ≈ proteína×4 + carbo×4 + gordura×9 (regra de
 * Atwater). Existe pra impedir cadastros fisicamente impossíveis (ex.: 322 g
 * de proteína e 323 g de gordura numa entrada de 321 kcal), que quebravam os
 * gráficos/barras de macro. Tolerância de 15% cobre arredondamento de
 * embalagem e fontes de dados nutricionais que arredondam kcal.
 */
const TOLERANCIA_PCT = 0.15;
const TOLERANCIA_MIN_KCAL = 20; // piso absoluto p/ entradas pequenas (ex.: 5 kcal)

export type MacrosEntrada = {
  kcal: number;
  prot: number;
  carb: number;
  gord: number;
};

export function kcalEstimada({ prot, carb, gord }: Omit<MacrosEntrada, "kcal">): number {
  return prot * 4 + carb * 4 + gord * 9;
}

/**
 * Retorna null se coerente, ou uma mensagem de erro pronta para exibir/lançar
 * caso o kcal informado esteja fora da tolerância em relação ao estimado
 * pelos macros.
 */
export function erroCoerenciaMacros(entrada: MacrosEntrada): string | null {
  const { kcal, prot, carb, gord } = entrada;
  if (kcal < 0 || prot < 0 || carb < 0 || gord < 0) {
    return "Valores não podem ser negativos.";
  }
  const estimada = kcalEstimada({ prot, carb, gord });
  const tolerancia = Math.max(TOLERANCIA_MIN_KCAL, estimada * TOLERANCIA_PCT);
  if (Math.abs(kcal - estimada) > tolerancia) {
    return `Kcal incompatível com os macros: ${prot}g proteína + ${carb}g carbo + ${gord}g gordura ≈ ${Math.round(
      estimada
    )} kcal, mas foi informado ${Math.round(kcal)} kcal.`;
  }
  return null;
}
