import "server-only";
import { db } from "@/lib/db";
import { urlAssinadaDocumento } from "@/lib/supabase/storage";

/**
 * Documento fixado do desafio ("contrato do grupo") — um por desafio,
 * substituído a cada novo upload. Sem "use cache": precisa refletir o
 * upload mais recente assim que a página recarrega.
 */

export type DesafioDocumentoView = {
  id: string;
  nome: string;
  arquivoUrl: string;
  arquivoTipo: string;
  enviadoPorId: string;
  enviadoPorNome: string | null;
  criadoEm: string;
};

export async function documentoDoDesafio(desafioId: string): Promise<DesafioDocumentoView | null> {
  const doc = await db.desafioDocumento.findUnique({ where: { desafioId } });
  if (!doc) return null;

  const [perfil, urlAssinada] = await Promise.all([
    db.profile.findUnique({
      where: { id: doc.enviadoPorId },
      select: { nome: true },
    }),
    urlAssinadaDocumento(doc.arquivoUrl),
  ]);
  // Sem URL assinada não há como abrir o arquivo — melhor sumir com o card
  // do que mostrar um link quebrado.
  if (!urlAssinada) return null;

  return {
    id: doc.id,
    nome: doc.nome,
    arquivoUrl: urlAssinada,
    arquivoTipo: doc.arquivoTipo,
    enviadoPorId: doc.enviadoPorId,
    enviadoPorNome: perfil?.nome ?? null,
    criadoEm: doc.criadoEm.toISOString(),
  };
}
