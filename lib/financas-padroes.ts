import "server-only";
import { db } from "@/lib/db";
import { revalidateTag } from "@/lib/cache-revalidate";
import { tagUsuario } from "@/lib/cache-tags";

/**
 * Toda conta financeira nasce utilizável: uma conta ("Pessoal") e as
 * categorias mais comuns já cadastradas.
 *
 * Antes disso, um usuário novo caía num formulário de transação com o seletor
 * de conta vazio — sem nenhuma tela para cadastrar contas, era impossível
 * lançar receita ou despesa.
 */

export const CONTA_PADRAO = {
  nome: "Pessoal",
  tipo: "corrente",
  cor: "#6B96D6",
} as const;

export type CategoriaPadrao = {
  nome: string;
  emoji: string;
  cor: string;
  tipo: "despesa" | "receita";
};

/** As 10 categorias que cobrem o grosso do gasto/ganho de qualquer pessoa. */
export const CATEGORIAS_PADRAO: CategoriaPadrao[] = [
  { nome: "Mercado", emoji: "🛒", cor: "#4EC9C0", tipo: "despesa" },
  { nome: "Alimentação", emoji: "🍽️", cor: "#F5B14C", tipo: "despesa" },
  { nome: "Moradia", emoji: "🏠", cor: "#FF6B6B", tipo: "despesa" },
  { nome: "Transporte", emoji: "🚗", cor: "#0D6EFD", tipo: "despesa" },
  { nome: "Saúde", emoji: "💊", cor: "#A78BDB", tipo: "despesa" },
  { nome: "Educação", emoji: "📚", cor: "#1A3F75", tipo: "despesa" },
  { nome: "Lazer", emoji: "🎉", cor: "#6B96D6", tipo: "despesa" },
  { nome: "Assinaturas", emoji: "🧾", cor: "#4E6A9C", tipo: "despesa" },
  { nome: "Salário", emoji: "💼", cor: "#4EC9C0", tipo: "receita" },
  { nome: "Renda extra", emoji: "💸", cor: "#F5B14C", tipo: "receita" },
];

/**
 * Chave em Setting que marca "esta conta financeira já recebeu os padrões".
 * Sem ela, quem apagasse a conta/categorias veria tudo voltar no próximo load.
 */
function chaveSeed(contaFinanceiraId: string): string {
  return `financas:padroes:${contaFinanceiraId}`;
}

/**
 * Cria conta + categorias padrão uma única vez por conta financeira.
 * Idempotente e barata quando já rodou: 1 leitura por PK.
 */
export async function garantirPadroesFinanceiros(
  userId: string,
  contaFinanceiraId: string
): Promise<void> {
  const key = chaveSeed(contaFinanceiraId);
  const marca = await db.setting.findUnique({
    where: { userId_key: { userId, key } },
    select: { value: true },
  });
  if (marca) return;

  // A marca é gravada ANTES de semear e funciona como trava: dois renders
  // concorrentes passam juntos pela leitura acima, mas só um vence o INSERT — o
  // perdedor recebe count 0 (skipDuplicates) e sai. Sem isso ele estourava
  // P2002 na marca no fim e, pior, semeava conta/categorias em duplicata.
  const { count } = await db.setting.createMany({
    data: [{ userId, key, value: new Date().toISOString() }],
    skipDuplicates: true,
  });
  if (count === 0) return;

  try {
    const [contas, categorias] = await Promise.all([
      db.account.count({ where: { contaFinanceiraId } }),
      db.category.findMany({ where: { contaFinanceiraId }, select: { nome: true } }),
    ]);

    // Quem já tem conta cadastrada não ganha outra — conta carrega saldo, criar
    // uma "Pessoal" do lado seria ruído. Já as categorias que faltam entram sem
    // tocar nas que a pessoa criou (comparação por nome, sem caixa/acento).
    const jaTem = new Set(categorias.map((c) => normalizar(c.nome)));
    const faltando = CATEGORIAS_PADRAO.filter((c) => !jaTem.has(normalizar(c.nome)));

    await Promise.all([
      contas === 0
        ? db.account.create({
            data: { userId, contaFinanceiraId, ...CONTA_PADRAO, saldoInicial: 0 },
          })
        : Promise.resolve(null),
      faltando.length > 0
        ? db.category.createMany({
            data: faltando.map((c) => ({ userId, contaFinanceiraId, ...c })),
          })
        : Promise.resolve(null),
    ]);
  } catch (erro) {
    // semeadura falhou no meio: solta a trava para a próxima tentativa rodar,
    // senão a conta ficaria marcada como semeada e nunca ganharia os padrões
    await db.setting
      .delete({ where: { userId_key: { userId, key } } })
      .catch(() => {});
    throw erro;
  }

  // O módulo lê contas/categorias por cache tag; sem derrubar a tag a tela
  // continuaria mostrando "nenhuma conta cadastrada" logo depois de semear.
  // Em contexto de render o Next recusa a invalidação — daí o try/catch: o
  // pior caso vira uma revalidação normal, de segundos.
  try {
    revalidateTag(tagUsuario(contaFinanceiraId, "financas"));
  } catch {
    // sem invalidação imediata: o cacheLife "usuario" resolve sozinho
  }
}

/** Compara nomes de categoria ignorando caixa e acento. */
function normalizar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}
