/**
 * Migra transferências antigas (accountId/contraAccountId) para o novo par
 * origemTipo/origemId + destinoTipo/destinoId. Roda uma vez, manualmente:
 *   npx tsx prisma/backfill-transferencias.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const antigas = await db.transaction.findMany({
    where: { tipo: "transferencia", origemTipo: null },
    select: { id: true, accountId: true, contraAccountId: true },
  });

  console.log(`Encontradas ${antigas.length} transferências para migrar.`);

  for (const t of antigas) {
    await db.transaction.update({
      where: { id: t.id },
      data: {
        origemTipo: t.accountId ? "conta" : null,
        origemId: t.accountId,
        destinoTipo: t.contraAccountId ? "conta" : null,
        destinoId: t.contraAccountId,
      },
    });
  }

  console.log("Backfill concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
