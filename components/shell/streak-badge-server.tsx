import { streakLC } from "@/lib/data/home";
import { StreakBadge } from "@/components/shell/streak-badge";
import { StreakCelebration } from "@/components/caverna/streak-celebration";

/**
 * Versão async do badge de streak: busca o streak sem bloquear o shell —
 * o layout a envolve em <Suspense> e o badge chega via streaming. Rende
 * também a celebração (client), que decide sozinha se aparece comparando com
 * o último streak visto no localStorage.
 */
export async function StreakBadgeServer({
  userId,
  isSuperAdmin = false,
}: {
  userId: string;
  isSuperAdmin?: boolean;
}) {
  // Falha na query não pode derrubar o layout — degrada para nada visível.
  try {
    const { streak, recordeAnterior, cumpriuHoje } = await streakLC(userId);
    return (
      <>
        <StreakBadge
          streak={streak}
          recorde={Math.max(streak, recordeAnterior)}
          cumpriuHoje={cumpriuHoje}
          isSuperAdmin={isSuperAdmin}
        />
        <StreakCelebration streak={streak} />
      </>
    );
  } catch {
    return null;
  }
}
