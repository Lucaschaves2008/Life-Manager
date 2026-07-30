import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "avatars";
const BUCKET_DOCUMENTOS = "desafio-documentos";

/** Sobe a foto de perfil do usuário, substituindo a anterior. Retorna a URL pública. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const supabase = createAdminClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/avatar.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw new Error(`Falha ao enviar imagem: ${error.message}`);

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

/** Sobe o documento fixado ("contrato") de um desafio, substituindo o anterior. Retorna a URL pública. */
export async function uploadDesafioDocumento(desafioId: string, file: File): Promise<string> {
  const supabase = createAdminClient();
  const ext = file.name.split(".").pop() || "pdf";
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

/** Remove o documento fixado do desafio no bucket. */
export async function removeDesafioDocumento(desafioId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: files } = await supabase.storage.from(BUCKET_DOCUMENTOS).list(desafioId);
  if (!files || files.length === 0) return;

  await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .remove(files.map((f) => `${desafioId}/${f.name}`));
}
