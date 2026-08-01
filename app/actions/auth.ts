"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const emailNormalizado = email.toLowerCase();

  // Cadastro pelo admin client (service_role) em vez de supabase.auth.signUp:
  // é o que permite `email_confirm: true`, ou seja, a conta já nasce
  // confirmada e a pessoa entra na hora, sem email de verificação.
  //
  // Com o signUp comum isso dependia do toggle "Confirm email" do projeto no
  // Supabase: com ele ligado, a conta nascia com confirmed=false, o
  // signInWithPassword recusava o login e a pessoa ficava presa numa conta que
  // já aparecia no /admin mas não conseguia acessar.
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: emailNormalizado,
    password,
    email_confirm: true,
    user_metadata: { nome },
  });

  if (error) {
    const msg =
      error.code === "email_exists" ||
      /already registered|already exists|user_already_exists/i.test(error.message)
        ? "Este email já está cadastrado."
        : /rate limit/i.test(error.message)
        ? "Muitas tentativas de cadastro em pouco tempo. Aguarde alguns minutos e tente novamente."
        : error.message;
    redirect(`/cadastro?erro=${encodeURIComponent(msg)}`);
  }

  if (!data.user) {
    redirect(`/cadastro?erro=${encodeURIComponent("Não foi possível criar a conta.")}`);
  }

  // Não há trigger no banco para popular Profile a partir de auth.users —
  // toda rotina de criação de usuário (aqui e em admin.ts) precisa fazer o
  // upsert manual. É o que faz a conta aparecer no /admin: aquela lista lê
  // Profile, não auth.users. Sem isto a pessoa também não consegue entrar
  // (resolveUser devolve null quando não acha o Profile).
  await db.profile.upsert({
    where: { id: data.user.id },
    create: { id: data.user.id, email: data.user.email ?? emailNormalizado, nome },
    update: { nome },
  });

  // Conta já confirmada: loga direto e cai no painel, sem passar pelo /login.
  const supabase = await createClient();
  const { error: erroLogin } = await supabase.auth.signInWithPassword({
    email: emailNormalizado,
    password,
  });
  if (erroLogin) {
    redirect(`/login?erro=${encodeURIComponent("Conta criada! Entre com seu email e senha.")}`);
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
