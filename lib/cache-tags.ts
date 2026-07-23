import "server-only";

/**
 * Tags de cache por usuário+módulo. Toda função de leitura cacheada
 * ("use cache") registra a tag de CADA módulo cujas tabelas ela lê, e toda
 * server action que grava chama revalidateTag(tagUsuario(userId, modulo)).
 * Assim a invalidação é cirúrgica: mutar finanças não derruba o cache de
 * treinos, e dados intocados são servidos da memória sem tocar o Postgres.
 */
export type ModuloCache =
  | "financas"
  | "investimentos"
  | "dieta"
  | "treinos"
  | "agenda"
  | "estudos"
  | "metas"
  | "checklist"
  | "settings";

export function tagUsuario(userId: string, modulo: ModuloCache): string {
  return `u:${userId}:${modulo}`;
}

/** Tag global de feriados — sem invalidação por action (TTL cuida). */
export const TAG_FERIADOS = "feriados";
