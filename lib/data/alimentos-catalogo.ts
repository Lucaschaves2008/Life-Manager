import { db } from "@/lib/db";

/**
 * Catálogo global de alimentos pré-carregado (AlimentoCatalogo, semeado via
 * `npm run db:seed:alimentos`). É a primeira opção na hora de montar uma
 * refeição — só cai no cadastro manual quando o alimento não está aqui.
 */

export type AlimentoCatalogoView = {
  id: string;
  nome: string;
  kcal100: number | null;
  prot100: number | null;
  carb100: number | null;
  gord100: number | null;
  porcaoNome: string | null;
  porcaoG: number | null;
};

export async function buscarAlimentosCatalogo(
  termo: string,
  limite = 8
): Promise<AlimentoCatalogoView[]> {
  const busca = termo.trim();
  if (!busca) return [];
  return db.alimentoCatalogo.findMany({
    where: { nome: { contains: busca, mode: "insensitive" } },
    orderBy: { nome: "asc" },
    take: limite,
  });
}
