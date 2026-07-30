import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { revalidateTag } from "@/lib/cache-revalidate";
import type { Profile } from "@prisma/client";

export type CurrentUser = {
  id: string;
  email: string;
  nome: string | null;
  telefone: string | null;
  avatarUrl: string | null;
  role: "user" | "super_admin";
  status: "ativo" | "bloqueado";
  criadoEm: Date;
};

function toCurrentUser(profile: Profile): CurrentUser {
  return {
    id: profile.id,
    email: profile.email,
    nome: profile.nome,
    telefone: profile.telefone,
    avatarUrl: profile.avatarUrl,
    role: profile.role as "user" | "super_admin",
    status: profile.status as "ativo" | "bloqueado",
    // unstable_cache serializa o resultado, então Date volta como string.
    criadoEm: new Date(profile.criadoEm),
  };
}

/**
 * Profile com cache incremental por usuário (tag profile:<id>), invalidado
 * por revalidateProfile() em toda action que altera Profile. O revalidate
 * de 5 min é o teto de staleness caso alguma invalidação escape — vale
 * também para o gate de status "bloqueado".
 */
function getProfileCached(userId: string): Promise<Profile | null> {
  return unstable_cache(
    () => db.profile.findUnique({ where: { id: userId } }),
    ["profile", userId],
    { tags: [`profile:${userId}`], revalidate: 300 }
  )();
}

/** Chamar em toda action que altera Profile (nome, avatar, status, role). */
export function revalidateProfile(userId: string) {
  revalidateTag(`profile:${userId}`);
}

/**
 * Resolve o usuário UMA vez por request (React.cache deduplica entre
 * middleware→layout→página→actions). getClaims() valida o JWT localmente
 * contra o JWKS (ES256, cacheado no processo) — zero round-trip à Auth API
 * com token válido; o refresh de sessão expirada segue com o middleware.
 */
const resolveUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;

  let profile = await getProfileCached(sub);
  // unstable_cache também guarda null: um perfil recém-criado ficaria
  // invisível por até 5 min. Null é raro — confere direto no banco.
  if (!profile) profile = await db.profile.findUnique({ where: { id: sub } });
  if (!profile) return null;

  return toCurrentUser(profile);
});

/**
 * Ponto único de autenticação para Server Components.
 * Redireciona para /login se não houver sessão, ou para /bloqueado se a
 * conta estiver com status "bloqueado".
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const user = await resolveUser();
  if (!user) redirect("/login");
  if (user.status === "bloqueado") redirect("/bloqueado");
  return user;
}

/** Mesma checagem, mas lança em vez de redirecionar — para uso em Server Actions. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await resolveUser();
  if (!user) throw new Error("Não autenticado.");
  if (user.status === "bloqueado") throw new Error("Conta bloqueada.");
  return user;
}

/** Igual a requireUser, mas exige role "super_admin". */
export async function requireSuperAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "super_admin") throw new Error("Acesso restrito a administradores.");
  return user;
}

/**
 * Busca o usuário atual sem redirecionar — retorna null se não houver sessão.
 * Uso: layout raiz, onde /login e /bloqueado não devem disparar redirect loop.
 */
export async function getCurrentUserOrNull(): Promise<CurrentUser | null> {
  return resolveUser();
}
