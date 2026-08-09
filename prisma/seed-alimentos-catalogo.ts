/**
 * Semeia o catálogo global de alimentos (AlimentoCatalogo) a partir de um
 * conjunto curado baseado na tabela TACO. Roda com: npm run db:seed:alimentos
 *
 * Idempotente: alimentos já existentes (mesmo nome + fonte) não são
 * duplicados, então pode rodar de novo com segurança pra adicionar itens
 * novos ao arquivo de dados sem duplicar o catálogo inteiro.
 */
import { PrismaClient } from "@prisma/client";
import dados from "./data/alimentos-taco.json";

const db = new PrismaClient();

async function main() {
  console.log("🥕 Semeando catálogo de alimentos (TACO)...");

  const existentes = await db.alimentoCatalogo.findMany({
    where: { fonte: "taco" },
    select: { nome: true },
  });
  const nomesExistentes = new Set(existentes.map((e) => e.nome));

  const novos = dados.filter((item) => !nomesExistentes.has(item.nome));
  if (novos.length > 0) {
    await db.alimentoCatalogo.createMany({
      data: novos.map((item) => ({ ...item, fonte: "taco" })),
    });
  }

  console.log(
    `✅ ${novos.length} alimentos novos no catálogo (${dados.length - novos.length} já existiam).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
