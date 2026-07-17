import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";
import "./globals.css";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = {
  title: "LC · Lucas Chaves",
  description: "Painel premium pessoal para finanças, investimentos, dieta, treinos e agenda.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={GeistSans.variable}>
      <body>
        <AppShell>{children}</AppShell>
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
