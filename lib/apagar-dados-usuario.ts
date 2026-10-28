import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type Modelo = { name: string; fields: readonly { name: string; type: string; relationFromFields?: readonly string[] }[] };

/**
 * Todos os modelos com `userId`, na ordem em que podem ser apagados sem
 * esbarrar em chave estrangeira: quem aponta para um modelo vem antes dele.
 * Derivado do schema em tempo de execução — modelo novo com userId entra
 * sozinho, sem ninguém lembrar de atualizar uma lista.
 */
export function ordemDeExclusao(
  modelos: readonly Modelo[] = Prisma.dmmf.datamodel.models
): string[] {
  const doUsuario = modelos.filter((m) => m.fields.some((f) => f.name === "userId"));
  const ordem: string[] = [];
  const emVisita = new Set<string>();

  const visitar = (nome: string) => {
    if (ordem.includes(nome) || emVisita.has(nome)) return;
    emVisita.add(nome);
    for (const filho of doUsuario) {
      const aponta = filho.fields.some((f) => f.type === nome && f.relationFromFields?.length);
      if (filho.name !== nome && aponta) visitar(filho.name);
    }
    ordem.push(nome);
  };
  for (const m of doUsuario) visitar(m.name);
  return ordem;
}

type Apagavel = { deleteMany(args: { where: Record<string, string> }): Prisma.PrismaPromise<unknown> };

/**
 * Apaga TODOS os dados pessoais do usuário (LGPD), numa transação só: ou sai
 * tudo, ou nada. Desafios criados por ele continuam existindo para os outros
 * membros — só a participação, as metas, mensagens e votos dele saem.
 */
export async function apagarDadosDoUsuario(userId: string): Promise<void> {
  const delegados = db as unknown as Record<string, Apagavel>;
  const delegado = (modelo: string) => delegados[modelo[0].toLowerCase() + modelo.slice(1)];

  await db.$transaction([
    // pedidos de mudança dele (autorId, não userId) — votos dos outros caem em cascata
    db.desafioSolicitacao.deleteMany({ where: { autorId: userId } }),
    ...ordemDeExclusao().map((m) => delegado(m).deleteMany({ where: { userId } })),
  ]);
}
