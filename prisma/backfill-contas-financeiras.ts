/**
 * Cria uma ContaFinanceira "Pessoal" (padrao=true) para cada userId com dados
 * em Finanças/Investimentos e preenche contaFinanceiraId nas 7 tabelas. Roda
 * uma vez, manualmente, antes de contaFinanceiraId virar NOT NULL:
 *   npx tsx prisma/backfill-contas-financeiras.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const TABELAS = [
  "account",
  "category",
  "card",
  "transaction",
  "subscription",
  "asset",
  "assetMovement",
] as const;

async function main() {
  const userIds = new Set<string>();
  for (const tabela of TABELAS) {
    const linhas = await (db[tabela] as any).findMany({
      where: { contaFinanceiraId: null },
      select: { userId: true },
      distinct: ["userId"],
    });
    linhas.forEach((l: { userId: string }) => userIds.add(l.userId));
  }

  console.log(`Encontrados ${userIds.size} usuários com dados a migrar.`);

  for (const userId of userIds) {
    let pessoal = await db.contaFinanceira.findFirst({
      where: { userId, padrao: true },
    });
    if (!pessoal) {
      pessoal = await db.contaFinanceira.create({
        data: { userId, nome: "Pessoal", padrao: true },
      });
    }

    for (const tabela of TABELAS) {
      const { count } = await (db[tabela] as any).updateMany({
        where: { userId, contaFinanceiraId: null },
        data: { contaFinanceiraId: pessoal.id },
      });
      if (count > 0) console.log(`  ${userId}: ${count} linhas em ${tabela}`);
    }
  }

  console.log("Backfill concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
