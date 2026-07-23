import { revisoesPendentes } from "@/lib/data/notificacoes";
import { NotificacoesBell } from "@/components/shell/notificacoes-bell";

/**
 * Versão async do sino: busca as revisões pendentes sem bloquear o shell —
 * o layout a envolve em <Suspense> e o sino chega via streaming.
 */
export async function NotificacoesBellServer({ userId }: { userId: string }) {
  // Falha na query não pode derrubar o layout inteiro — degrada para sino vazio.
  try {
    const notificacoes = await revisoesPendentes(userId);
    return <NotificacoesBell notificacoes={notificacoes} />;
  } catch {
    return <NotificacoesBell notificacoes={[]} />;
  }
}
