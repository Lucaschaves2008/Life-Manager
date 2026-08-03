// Constantes e tipos puros do checklist (sem I/O), separados de rotinas.ts para
// poderem ser importados por Client Components: rotinas.ts usa "use cache" +
// cache-tags (server-only) e não pode entrar no bundle do cliente. Mesmo padrão
// de treinos-format.ts e metas-quantitativas-constantes.ts.

// "corrida", "natacao" e "ciclismo" são os três tipos de cardio: todos apontam
// para uma RunSession (RotinaTemplate.runSessionId) e todos marcam sozinhos
// quando a sessão correspondente é registrada em Treinos. O que muda é só qual
// modalidade de plano o seletor oferece — ver TIPO_CARDIO abaixo.
export const TIPOS_ROTINA = [
  "livre",
  "estudo",
  "treino",
  "corrida",
  "natacao",
  "ciclismo",
  "refeicao",
] as const;

export type TipoRotina = (typeof TIPOS_ROTINA)[number];

/** Tipos de item que se vinculam a uma sessão de cardio, e a qual modalidade. */
export const TIPO_CARDIO = {
  corrida: "corrida",
  natacao: "natacao",
  ciclismo: "ciclismo",
} as const;

export type TipoCardio = keyof typeof TIPO_CARDIO;

export function ehTipoCardio(tipo: string): tipo is TipoCardio {
  return tipo in TIPO_CARDIO;
}

export type LocalItem = "checklist" | "habitos";
