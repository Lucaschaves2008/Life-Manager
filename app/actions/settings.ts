"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, revalidateProfile } from "@/lib/auth";
import { tagUsuario } from "@/lib/cache-tags";
import { createClient } from "@/lib/supabase/server";
import { removeAvatar, uploadAvatar } from "@/lib/supabase/storage";
import type { HomeCardConfig } from "@/lib/data/home-metricas";

/** Troca a métrica/período de um dos 4 cards principais da Home (slots "home_card_1".."home_card_4"). */
export async function updateHomeCard(slot: string, config: HomeCardConfig) {
  const { id: userId } = await requireUser();
  await db.setting.upsert({
    where: { userId_key: { userId, key: slot } },
    update: { value: JSON.stringify(config) },
    create: { userId, key: slot, value: JSON.stringify(config) },
  });
  revalidateTag(tagUsuario(userId, "settings"));
  revalidatePath("/");
}

/** Grava as configurações do usuário (chave/valor) numa tacada só. */
export async function saveSettings(entries: Record<string, string>) {
  const { id: userId } = await requireUser();
  await Promise.all(
    Object.entries(entries).map(([key, value]) =>
      db.setting.upsert({
        where: { userId_key: { userId, key } },
        update: { value },
        create: { userId, key, value },
      })
    )
  );

  revalidateTag(tagUsuario(userId, "settings"));
  revalidatePath("/");
  revalidatePath("/configuracoes");
  revalidatePath("/dieta");
  revalidatePath("/treinos");
}

/** Atualiza nome e telefone do perfil logado. */
export async function updateProfile(data: { nome: string; telefone: string }) {
  const { id: userId } = await requireUser();
  await db.profile.update({
    where: { id: userId },
    data: {
      nome: data.nome.trim() || null,
      telefone: data.telefone.trim() || null,
    },
  });
  revalidateProfile(userId);
  revalidatePath("/configuracoes");
  revalidatePath("/");
}

/** Sobe uma nova foto de perfil e substitui a anterior. */
export async function updateAvatar(formData: FormData) {
  const { id: userId } = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecione uma imagem.");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("A imagem deve ter até 2 MB.");
  }
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Use PNG, JPG ou WEBP.");
  }

  const url = await uploadAvatar(userId, file);
  await db.profile.update({ where: { id: userId }, data: { avatarUrl: url } });
  revalidateProfile(userId);
  revalidatePath("/configuracoes");
  revalidatePath("/");
}

/** Remove a foto de perfil atual. */
export async function clearAvatar() {
  const { id: userId } = await requireUser();
  await removeAvatar(userId);
  await db.profile.update({ where: { id: userId }, data: { avatarUrl: null } });
  revalidateProfile(userId);
  revalidatePath("/configuracoes");
  revalidatePath("/");
}

/** Troca a senha do usuário logado, reautenticando com a senha atual antes. */
export async function changePassword(currentPassword: string, newPassword: string) {
  const { email } = await requireUser();
  if (newPassword.length < 8) {
    throw new Error("A nova senha deve ter no mínimo 8 caracteres.");
  }

  const supabase = await createClient();
  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (authError) throw new Error("Senha atual incorreta.");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
