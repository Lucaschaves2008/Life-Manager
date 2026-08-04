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

// ---------- Ingredientes ----------

/** Unidades aceitas num ingrediente. "ml" conta como grama (≈1 g/ml). */
export const UNIDADES = [
  { valor: "g", label: "gramas" },
  { valor: "ml", label: "ml" },
  { valor: "porcao", label: "porções" },
] as const;

const numero = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/**
 * Plural da medida caseira, só na primeira palavra: "colher de sopa" →
 * "colheres de sopa", "unidade" → "unidades". Cobre o que aparece numa cozinha;
 * o resto cai no acréscimo de "s", que erra pouco e nunca quebra a leitura.
 */
export function pluralPorcao(nome: string): string {
  const [primeira, ...resto] = nome.trim().split(" ");
  if (!primeira) return nome;
  const plural = /r$|z$/i.test(primeira)
    ? `${primeira}es`
    : /s$/i.test(primeira)
      ? primeira
      : /(ão)$/i.test(primeira)
        ? primeira.replace(/ão$/i, "ões")
        : /l$/i.test(primeira)
          ? primeira.replace(/l$/i, "is")
          : `${primeira}s`;
  return [plural, ...resto].join(" ");
}

export type IngredienteLike = {
  nome: string;
  /** null = "a gosto" — entra na lista sem somar macro. */
  quantidade: number | null;
  unidade: string;
  porcaoNome: string | null;
};

/** "2 colheres de sopa de requeijão", "60 g de aveia", "sal a gosto". */
export function rotuloIngrediente(item: IngredienteLike): string {
  const { nome, quantidade, unidade, porcaoNome } = item;
  if (quantidade == null) return `${nome} a gosto`;
  if (unidade === "porcao") {
    const medida = porcaoNome?.trim() || "porção";
    return `${numero(quantidade)} ${quantidade > 1 ? pluralPorcao(medida) : medida} de ${nome}`;
  }
  return `${numero(quantidade)} ${unidade === "ml" ? "ml" : "g"} de ${nome}`;
}
