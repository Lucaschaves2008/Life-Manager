import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client com a service_role key — ignora RLS por design. Uso exclusivo das
 * rotinas de super-admin (listar/bloquear/criar usuários). Nunca importar
 * este módulo em código que roda no client ("server-only" quebra o build
 * se isso acontecer por engano).
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
