import { Input, Label } from "@/components/ui/input";
import { BotaoEnviar } from "@/components/auth/botao-enviar";
import { PainelMarca } from "@/components/auth/painel-marca";
import { LcLogo } from "@/components/shell/lc-logo";
import { signIn } from "@/app/actions/auth";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; next?: string }>;
}) {
  const { erro, next } = await searchParams;

  return (
    <div className="flex min-h-dvh">
      {/* Coluna do formulário */}
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-[440px] lg:shrink-0 lg:px-14 xl:w-[480px]">
        <div className="mx-auto w-full max-w-[340px]">
          <LcLogo className="h-5" />

          <div className="mt-10 mb-8">
            <h1 className="display text-[26px] text-paper">Bem-vindo de volta</h1>
            <p className="mt-1.5 text-[13.5px] text-mist">
              Entre com suas credenciais para acessar seu painel.
            </p>
          </div>

          {erro && (
            <div className="mb-5 rounded-[14px] border border-[rgba(255,107,107,.25)] bg-coral-soft px-3.5 py-2.5 text-[13px] text-coral">
              {erro}
            </div>
          )}

          <form action={signIn} className="space-y-4">
            <input type="hidden" name="next" value={next ?? "/"} />

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="voce@exemplo.com"
              />
            </div>

            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
            </div>

            <BotaoEnviar pendente="Entrando…">Entrar</BotaoEnviar>
          </form>

          <p className="mt-8 text-center text-[12px] text-steel">
            Não tem conta?{" "}
            <Link href="/cadastro" className="text-mist underline underline-offset-2">
              Criar conta
            </Link>
          </p>
        </div>
      </div>

      <PainelMarca />
    </div>
  );
}
