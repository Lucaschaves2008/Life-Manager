import "server-only";
import { db } from "@/lib/db";
import type { ContaFinanceiraView } from "@/lib/contas-financeiras-shared";
import { garantirPadroesFinanceiros } from "@/lib/financas-padroes";

/**
 * Lista as contas financeiras do usuário; garante que "Pessoal" sempre exista.
 *
 * Mora aqui (server-only) e NÃO em app/actions: todo export de um arquivo
 * "use server" vira endpoint HTTP público, e esta função recebe o userId
 * como parâmetro — exposta, qualquer um leria/criaria contas de outro usuário.
 * Quem chama já resolveu o usuário via requireUser()/getCurrentUser().
 */
export async function listarContasFinanceiras(
  userId: string
): Promise<ContaFinanceiraView[]> {
  const contas = await db.contaFinanceira.findMany({
    where: { userId },
    orderBy: [{ padrao: "desc" }, { criadoEm: "asc" }],
  });
  if (contas.length > 0) return contas;

  const pessoal = await db.contaFinanceira.create({
    data: { userId, nome: "Pessoal", padrao: true },
  });
  await garantirPadroesFinanceiros(userId, pessoal.id);
  return [pessoal];
}
