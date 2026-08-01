"use server";

import { revalidatePath } from "@/lib/cache-revalidate";
import { requireSuperAdmin, revalidateProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Invalidação de cache NUNCA pode derrubar uma escrita já commitada. Em
 * criarUsuario o usuário do Supabase Auth já existe quando isto roda: deixar
 * um erro de cache subir aqui aborta a action DEPOIS do efeito colateral
 * irreversível, e o retry seguinte esbarra em "email_exists" pra sempre.
 * Cache defasado se resolve sozinho (perfil "usuario", 30s); auth órfão não.
 */
function revalidar(userId?: string) {
  try {
    if (userId) revalidateProfile(userId);
    revalidatePath("/admin");
  } catch (e) {
    console.error("[admin] falha ao invalidar cache (ignorada):", e);
  }
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
  const emailNormalizado = email.trim().toLowerCase();
  const senhaFinal = senha?.trim() || crypto.randomUUID().replace(/-/g, "").slice(0, 12);

  let usuario: { id: string; email?: string } | null = null;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: emailNormalizado,
    password: senhaFinal,
    email_confirm: true,
    user_metadata: nome ? { nome } : undefined,
  });

  if (error) {
    // Criar no Auth e gravar o Profile são dois sistemas distintos, sem
    // transação em volta. Se a primeira tentativa criou o usuário no Auth e
    // morreu antes do Profile, o Auth passa a responder "email_exists" e o
    // admin fica travado: o usuário existe, não tem Profile (resolveUser
    // devolve null, ele não consegue entrar) e recriar é impossível.
    // Em vez de repetir o erro, adota o usuário órfão: reaplica a senha e
    // grava o Profile que faltou.
    if (error.code !== "email_exists") throw new Error(error.message);

    const existente = await buscarUsuarioAuthPorEmail(supabaseAdmin, emailNormalizado);
    if (!existente) throw new Error(error.message);

    const { error: erroSenha } = await supabaseAdmin.auth.admin.updateUserById(existente.id, {
      password: senhaFinal,
      email_confirm: true,
      ...(nome ? { user_metadata: { nome } } : {}),
    });
    if (erroSenha) throw new Error(erroSenha.message);

    usuario = existente;
  } else {
    usuario = data.user;
  }

  if (!usuario) throw new Error("Não foi possível criar o usuário no Auth.");

  await db.profile.upsert({
    where: { id: usuario.id },
    create: { id: usuario.id, email: usuario.email ?? emailNormalizado, nome: nome || null },
    update: { nome: nome || undefined },
  });

  revalidar(usuario.id);
  return senhaFinal;
}

/** Procura um usuário no Supabase Auth pelo email, paginando a listagem. */
async function buscarUsuarioAuthPorEmail(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<{ id: string; email?: string } | null> {
  const alvo = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const achado = data.users.find((u) => u.email?.toLowerCase() === alvo);
    if (achado) return { id: achado.id, email: achado.email };
    if (data.users.length < 200) break;
  }
  return null;
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
