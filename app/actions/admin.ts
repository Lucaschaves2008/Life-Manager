"use server";

import { revalidatePath } from "@/lib/cache-revalidate";
import { requireSuperAdmin, revalidateProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";

function revalidar(userId?: string) {
  if (userId) revalidateProfile(userId);
  revalidatePath("/admin");
}

export async function bloquearUsuario(id: string) {
  const admin = await requireSuperAdmin();
  if (id === admin.id) throw new Error("Você não pode bloquear a si mesmo.");
  await db.profile.update({ where: { id }, data: { status: "bloqueado" } });
  revalidar(id);
}

export async function desbloquearUsuario(id: string) {
  await requireSuperAdmin();
  await db.profile.update({ where: { id }, data: { status: "ativo" } });
  revalidar(id);
}

export async function promoverParaAdmin(id: string) {
  await requireSuperAdmin();
  await db.profile.update({ where: { id }, data: { role: "super_admin" } });
  revalidar(id);
}

export async function rebaixarParaUsuario(id: string) {
  const admin = await requireSuperAdmin();
  if (id === admin.id) throw new Error("Você não pode rebaixar a si mesmo.");
  await db.profile.update({ where: { id }, data: { role: "user" } });
  revalidar(id);
}

/** Convida um novo usuário por email — ele recebe um link para definir a senha. */
export async function convidarUsuario(email: string, nome?: string) {
  await requireSuperAdmin();
  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: nome ? { nome } : undefined,
  });
  if (error) throw new Error(error.message);

  if (data.user && nome) {
    await db.profile.update({ where: { id: data.user.id }, data: { nome } }).catch(() => {});
  }

  revalidar(data.user?.id);
}

/**
 * Cria um usuário diretamente com email e senha, sem enviar nenhum email.
 * A senha é retornada em texto plano para o admin repassar manualmente.
 * Se `senha` não for informada, gera uma senha aleatória.
 */
export async function criarUsuario(
  email: string,
  nome?: string,
  senha?: string
): Promise<string> {
  await requireSuperAdmin();
  const supabaseAdmin = createAdminClient();
  const senhaFinal = senha?.trim() || crypto.randomUUID().replace(/-/g, "").slice(0, 12);

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: senhaFinal,
    email_confirm: true,
    user_metadata: nome ? { nome } : undefined,
  });
  if (error) throw new Error(error.message);

  if (data.user) {
    await db.profile.upsert({
      where: { id: data.user.id },
      create: { id: data.user.id, email: data.user.email!, nome: nome || null },
      update: { nome: nome || undefined },
    });
  }

  revalidar(data.user?.id);
  return senhaFinal;
}

export async function excluirUsuario(id: string) {
  const admin = await requireSuperAdmin();
  if (id === admin.id) throw new Error("Você não pode excluir a si mesmo.");

  // Bloqueia antes de excluir: se algo falhar no meio do processo, o gate de
  // status já barra o acesso do usuário (o JWT continua válido até expirar).
  await db.profile.update({ where: { id }, data: { status: "bloqueado" } }).catch(() => {});
  revalidateProfile(id);

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);

  await db.profile.deleteMany({ where: { id } });
  revalidar(id);
}

/** Edita nome e telefone de outro usuário. */
export async function atualizarUsuarioAdmin(
  id: string,
  data: { nome: string; telefone: string }
) {
  await requireSuperAdmin();
  await db.profile.update({
    where: { id },
    data: {
      nome: data.nome.trim() || null,
      telefone: data.telefone.trim() || null,
    },
  });
  revalidar(id);
}

/** Gera uma nova senha para o usuário e a retorna em texto plano para o admin copiar. */
export async function resetarSenhaUsuario(id: string): Promise<string> {
  await requireSuperAdmin();
  const novaSenha = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
    password: novaSenha,
  });
  if (error) throw new Error(error.message);

  return novaSenha;
}
