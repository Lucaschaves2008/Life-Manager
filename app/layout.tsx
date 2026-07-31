import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";
import "./globals.css";
import { AppShell } from "@/components/shell/app-shell";
import { NotificacoesBell } from "@/components/shell/notificacoes-bell";
import { NotificacoesBellServer } from "@/components/shell/notificacoes-bell-server";
import { StreakBadgeServer } from "@/components/shell/streak-badge-server";
import { getCurrentUserOrNull } from "@/lib/auth";
import { ThemeScript } from "@/components/shell/theme-script";

export const metadata: Metadata = {
  title: "MYLIFE",
  description: "Painel premium pessoal para finanças, investimentos, dieta, treinos e agenda.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0b",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUserOrNull();

  // O sino busca dados via streaming (Suspense) para não bloquear o shell.
  // Conta bloqueada não recebe o slot (nada de dados no payload de /bloqueado).
  const notificacoesSlot = user && user.status === "ativo" ? (
    <Suspense fallback={<NotificacoesBell notificacoes={[]} />}>
      <NotificacoesBellServer userId={user.id} />
    </Suspense>
  ) : null;

  // Badge de streak (foguinho) sempre visível no topbar — também via streaming.
  const streakSlot = user && user.status === "ativo" ? (
    <Suspense fallback={null}>
      <StreakBadgeServer
        userId={user.id}
        isSuperAdmin={user.role === "super_admin"}
      />
    </Suspense>
  ) : null;

  // suppressHydrationWarning: extensões do navegador (ColorZilla, Grammarly…)
  // injetam atributos no <html>/<body> antes da hidratação, e o ThemeSelect
  // aplica data-theme na raiz — nada disso é mismatch real da app
  return (
    <html lang="pt-BR" className={GeistSans.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body suppressHydrationWarning>
        <AppShell
          isSuperAdmin={user?.role === "super_admin"}
          user={{
            nome: user?.nome ?? null,
            email: user?.email ?? "",
            avatarUrl: user?.avatarUrl ?? null,
          }}
          notificacoesSlot={notificacoesSlot}
          streakSlot={streakSlot}
        >
          {children}
        </AppShell>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--color-elevated)",
              border: "1px solid var(--color-stroke)",
              borderRadius: "12px",
              color: "var(--color-ice)",
              boxShadow: "0 16px 48px rgba(0,0,0,.5)",
            },
          }}
        />
      </body>
    </html>
  );
}
