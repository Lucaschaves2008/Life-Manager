import { db } from "@/lib/db";

/**
 * Chat do desafio — histórico simples (sem edição/exclusão), lido via polling
 * pela UI. Sem "use cache": precisa estar sempre fresh entre polls.
 */

export type MensagemView = {
  id: string;
  userId: string;
  nome: string | null;
  avatarUrl: string | null;
  texto: string;
  criadoEm: string; // ISO — serializável em polling
};

const LIMITE_MENSAGENS = 100;

export async function mensagensDoDesafio(desafioId: string): Promise<MensagemView[]> {
  const mensagens = await db.desafioMensagem.findMany({
    where: { desafioId },
    orderBy: { criadoEm: "desc" },
    take: LIMITE_MENSAGENS,
  });
  if (mensagens.length === 0) return [];

  const perfis = await db.profile.findMany({
    where: { id: { in: [...new Set(mensagens.map((m) => m.userId))] } },
    select: { id: true, nome: true, avatarUrl: true },
  });
  const perfilPorId = new Map(perfis.map((p) => [p.id, p]));

  return mensagens
    .slice()
    .reverse()
    .map((m) => ({
      id: m.id,
      userId: m.userId,
      nome: perfilPorId.get(m.userId)?.nome ?? null,
      avatarUrl: perfilPorId.get(m.userId)?.avatarUrl ?? null,
      texto: m.texto,
      criadoEm: m.criadoEm.toISOString(),
    }));
}
