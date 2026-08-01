"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";

export async function signUp(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmarSenha = String(formData.get("confirmarSenha") ?? "");

  if (!nome || !email || !password) {
    redirect(`/cadastro?erro=${encodeURIComponent("Preencha todos os campos.")}`);
  }
  if (password.length < 8) {
    redirect(`/cadastro?erro=${encodeURIComponent("A senha precisa ter no mínimo 8 caracteres.")}`);
  }
  if (password !== confirmarSenha) {
    redirect(`/cadastro?erro=${encodeURIComponent("As senhas não coincidem.")}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nome } },
  });

  if (error) {
    const msg = /already registered|already exists|user_already_exists/i.test(error.message)
      ? "Este email já está cadastrado."
      : /rate limit/i.test(error.message)
      ? "Muitas tentativas de cadastro em pouco tempo. Aguarde alguns minutos e tente novamente."
      : error.message;
    redirect(`/cadastro?erro=${encodeURIComponent(msg)}`);
  }

  if (!data.user) {
    redirect(`/cadastro?erro=${encodeURIComponent("Não foi possível criar a conta.")}`);
  }

  // Com confirmação de email ativa, o Supabase não retorna erro para um email
  // já cadastrado mas ainda não confirmado — por proteção anti-enumeration,
  // ele responde como um signUp normal só que com identities: [] (nenhuma
  // identidade nova criada). É o único sinal disponível para detectar o caso.
  if (data.user.identities?.length === 0) {
    redirect(`/cadastro?erro=${encodeURIComponent("Este email já está cadastrado.")}`);
  }

  // Não há trigger no banco para popular Profile a partir de auth.users —
  // toda rotina de criação de usuário (aqui e em admin.ts) precisa fazer o upsert manual.
  await db.profile.upsert({
    where: { id: data.user.id },
    create: { id: data.user.id, email: data.user.email!, nome },
    update: { nome },
  });

  // Sem sessão de volta = confirmação de email está ativa no projeto Supabase.
  if (!data.session) {
    redirect(`/login?erro=${encodeURIComponent("Conta criada! Confira seu email para confirmar antes de entrar.")}`);
  }

  redirect("/");
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  // Só aceita caminho interno — bloqueia open redirect ("https://…", "//…", "/\…").
  const rawNext = String(formData.get("next") ?? "/");
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\")
      ? rawNext
      : "/";

  if (!email || !password) {
    redirect(`/login?erro=${encodeURIComponent("Preencha email e senha.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?erro=${encodeURIComponent("Email ou senha inválidos.")}`);
  }

  redirect(next || "/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
