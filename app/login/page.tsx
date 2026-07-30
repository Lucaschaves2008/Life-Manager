import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LcLogo } from "@/components/shell/lc-logo";
import { signIn } from "@/app/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; next?: string }>;
}) {
  const { erro, next } = await searchParams;

  return (
    <div className="flex min-h-screen">
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

            <Button type="submit" variant="primary" size="md" className="w-full !h-10.5 mt-2">
              Entrar
            </Button>
          </form>

          <p className="mt-8 text-center text-[12px] text-steel">
            Acesso restrito · uso pessoal
          </p>
        </div>
      </div>

      {/* Coluna visual */}
      <div className="relative hidden flex-1 overflow-hidden bg-bg lg:block">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 15% 12%, rgba(13,110,253,.22), transparent 55%), radial-gradient(90% 70% at 85% 88%, rgba(78,201,192,.12), transparent 50%), var(--color-bg)",
          }}
        />
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.07]"
          aria-hidden="true"
        >
          <defs>
            <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse">
              <path d="M 44 0 L 0 0 0 44" fill="none" stroke="var(--color-ice)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        <div className="relative flex h-full flex-col justify-between p-14">
          <div />

          <div className="max-w-md">
            <LcLogo className="h-8 text-paper opacity-90" />
            <p className="display mt-6 text-[30px] leading-[1.25] text-paper">
              Finanças, saúde e rotina em um único painel.
            </p>
            <p className="mt-4 text-[14px] leading-relaxed text-mist">
              Acompanhe cartões, investimentos, dieta, treinos e agenda com uma
              visão clara e centralizada do seu dia a dia.
            </p>
          </div>

          <div className="flex items-center gap-6 text-[12px] text-steel">
            <span className="tabular">Finanças</span>
            <span className="h-1 w-1 rounded-full bg-stroke" />
            <span className="tabular">Investimentos</span>
            <span className="h-1 w-1 rounded-full bg-stroke" />
            <span className="tabular">Dieta</span>
            <span className="h-1 w-1 rounded-full bg-stroke" />
            <span className="tabular">Treinos</span>
            <span className="h-1 w-1 rounded-full bg-stroke" />
            <span className="tabular">Agenda</span>
          </div>
        </div>
      </div>
    </div>
  );
}
