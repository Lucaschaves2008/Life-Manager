import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { AppShell } from "@/components/shell/app-shell";

const instrument = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  title: "Caverna",
  description: "Modo caverna: finanças, investimentos, dieta, treinos e agenda.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${GeistSans.variable} ${instrument.variable}`}
    >
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
