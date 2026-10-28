import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "avatars";
const BUCKET_DOCUMENTOS = "desafio-documentos";

/**
 * Extensão derivada do MIME já validado pela action — nunca do nome do
 * arquivo, que o cliente controla (evita gravar `x.html`/`x.svg` no bucket).
 */
const EXTENSAO_POR_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function extensaoSegura(file: File): string {
  const ext = EXTENSAO_POR_MIME[file.type];
  if (!ext) throw new Error("Formato de arquivo não permitido.");
  return ext;
}

/** Sobe a foto de perfil do usuário, substituindo a anterior. Retorna a URL pública. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const supabase = createAdminClient();
  const ext = extensaoSegura(file);
  const path = `${userId}/avatar.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw new Error(`Falha ao enviar imagem: ${error.message}`);

  // Só depois do upload: trocar de png pra jpg deixaria o antigo órfão, mas
  // apagar ANTES faria um upload que falhou deixar o perfil sem foto.
  const { data: antigos } = await supabase.storage.from(BUCKET).list(userId);
  const sobras = (antigos ?? []).filter((f) => f.name !== `avatar.${ext}`);
  if (sobras.length > 0) {
    await supabase.storage.from(BUCKET).remove(sobras.map((f) => `${userId}/${f.name}`));
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

/** Remove todos os arquivos de avatar do usuário no bucket. */
export async function removeAvatar(userId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: files } = await supabase.storage.from(BUCKET).list(userId);
  if (!files || files.length === 0) return;

  await supabase.storage
    .from(BUCKET)
    .remove(files.map((f) => `${userId}/${f.name}`));
}

/**
 * Sobe o documento fixado ("contrato") de um desafio, substituindo o anterior.
 * Retorna a URL no formato público, que é guardada no banco só como
 * referência do caminho — a leitura passa sempre por urlAssinadaDocumento.
 */
export async function uploadDesafioDocumento(desafioId: string, file: File): Promise<string> {
  const supabase = createAdminClient();
  const ext = extensaoSegura(file);
  const path = `${desafioId}/documento.${ext}`;

  const { data: antigos } = await supabase.storage.from(BUCKET_DOCUMENTOS).list(desafioId);
  if (antigos && antigos.length > 0) {
    await supabase.storage
      .from(BUCKET_DOCUMENTOS)
      .remove(antigos.map((f) => `${desafioId}/${f.name}`));
  }

  const { error } = await supabase.storage.from(BUCKET_DOCUMENTOS).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw new Error(`Falha ao enviar documento: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET_DOCUMENTOS).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

/**
 * URL temporária (24h) para ler o documento do desafio. O bucket é privado:
 * o documento só é entregue a quem passou pelo requireMembro da página/action,
 * e um link vazado expira sozinho.
 */
export async function urlAssinadaDocumento(arquivoUrl: string): Promise<string | null> {
  const caminho = arquivoUrl.match(new RegExp(`/${BUCKET_DOCUMENTOS}/([^?]+)`))?.[1];
  if (!caminho) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .createSignedUrl(decodeURIComponent(caminho), 60 * 60 * 24);
  if (error) return null;
  return data.signedUrl;
}

/** Remove o documento fixado do desafio no bucket. */
export async function removeDesafioDocumento(desafioId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: files } = await supabase.storage.from(BUCKET_DOCUMENTOS).list(desafioId);
  if (!files || files.length === 0) return;

  await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .remove(files.map((f) => `${desafioId}/${f.name}`));
}
