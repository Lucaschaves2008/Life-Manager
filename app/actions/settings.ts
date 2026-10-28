"use server";

import { revalidatePath, revalidateTag } from "@/lib/cache-revalidate";
import { db } from "@/lib/db";
import { requireUser, revalidateProfile } from "@/lib/auth";
import { tagUsuario } from "@/lib/cache-tags";
import { createClient } from "@/lib/supabase/server";
import { removeAvatar, uploadAvatar } from "@/lib/supabase/storage";
import { consumirLimite, MSG_MUITAS_TENTATIVAS } from "@/lib/rate-limit";
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
  const pares = Object.entries(entries);
  if (
    pares.length > 50 ||
    pares.some(([k, v]) => typeof v !== "string" || k.length > 64 || v.length > 10_000)
  ) {
    throw new Error("Configurações inválidas.");
  }
  await Promise.all(
    pares.map(([key, value]) =>
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
      nome: data.nome.trim().slice(0, 80) || null,
      telefone: data.telefone.trim().slice(0, 30) || null,
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
  const { id: userId, email } = await requireUser();
  if (newPassword.length < 8) {
    throw new Error("A nova senha deve ter no mínimo 8 caracteres.");
  }
  if (new TextEncoder().encode(newPassword).length > 72) {
    throw new Error("A nova senha pode ter no máximo 72 caracteres.");
  }
  // A checagem da senha atual é um oráculo de senha: sem limite, uma sessão
  // roubada serviria pra descobrir a senha por força bruta.
  if (!(await consumirLimite(`senha:user:${userId}`, 5, 15 * 60))) {
    throw new Error(MSG_MUITAS_TENTATIVAS);
  }

  const supabase = await createClient();
  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (authError) throw new Error("Senha atual incorreta.");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);

  // Derruba as outras sessões: se a troca foi motivada por suspeita de acesso
  // indevido, quem estava logado em outro lugar perde o acesso na hora.
  await supabase.auth.signOut({ scope: "others" });
}
