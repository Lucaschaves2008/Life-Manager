import { ConquistasWatcher } from "@/components/caverna/conquista-toast";
import { conquistasPendentes } from "@/lib/data/conquistas-server";
import { nowSP } from "@/lib/dates";

/**
 * Detecta e entrega as conquistas do momento ao client (que dispara o toast).
 * Renderizado dentro de <Suspense> no layout — nunca bloqueia o shell.
 */
export async function ConquistasServer({ userId }: { userId: string }) {
  const { conquistas, habilitado } = await conquistasPendentes(userId, nowSP());
  if (conquistas.length === 0) return null;
  return <ConquistasWatcher conquistas={conquistas} habilitado={habilitado} />;
}
