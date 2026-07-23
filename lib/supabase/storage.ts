import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "avatars";

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
