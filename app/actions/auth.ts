"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { consumirLimite, ipDaRequisicao, MSG_MUITAS_TENTATIVAS } from "@/lib/rate-limit";

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signUp(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmarSenha = String(formData.get("confirmarSenha") ?? "");

  // O cadastro usa a service_role (createUser), que não passa pelos limites
  // nativos do Supabase Auth — sem isto daria pra criar contas em massa.
  const ip = await ipDaRequisicao();
  if (!(await consumirLimite(`cadastro:ip:${ip}`, 5, 60 * 60))) {
    redirect(`/cadastro?erro=${encodeURIComponent(MSG_MUITAS_TENTATIVAS)}`);
  }

  if (!nome || !email || !password) {
    redirect(`/cadastro?erro=${encodeURIComponent("Preencha todos os campos.")}`);
  }
  if (nome.length > 80 || email.length > 254 || !EMAIL_VALIDO.test(email)) {
    redirect(`/cadastro?erro=${encodeURIComponent("Confira o nome e o email.")}`);
  }
  if (password.length < 8) {
    redirect(`/cadastro?erro=${encodeURIComponent("A senha precisa ter no mínimo 8 caracteres.")}`);
  }
  // bcrypt (Supabase Auth) ignora tudo depois de 72 bytes.
  if (new TextEncoder().encode(password).length > 72) {
    redirect(`/cadastro?erro=${encodeURIComponent("A senha pode ter no máximo 72 caracteres.")}`);
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

  // Anti força bruta. O Supabase Auth só enxerga o IP do servidor da Vercel
  // (a chamada sai daqui, não do navegador), então o limite nativo dele não
  // distingue atacante de usuário legítimo — o controle precisa ser nosso.
  // Por email+IP (não só email): limitar só por email deixaria qualquer um
  // trancar a conta de outra pessoa mandando 8 senhas erradas com o email dela.
  // Por IP: protege contra um IP testando muitas contas (credential stuffing).
  // Email vai em hash: a tabela de limite não precisa guardar dado pessoal.
  const ip = await ipDaRequisicao();
  const emailHash = createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 32);
  const [porEmail, porIp] = await Promise.all([
    consumirLimite(`login:email-ip:${emailHash}:${ip}`, 8, 15 * 60),
    consumirLimite(`login:ip:${ip}`, 30, 15 * 60),
  ]);
  if (!porEmail || !porIp) {
    redirect(`/login?erro=${encodeURIComponent(MSG_MUITAS_TENTATIVAS)}`);
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
