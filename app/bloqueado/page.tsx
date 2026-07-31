import { Button } from "@/components/ui/button";
import { signOut } from "@/app/actions/auth";

export default function BloqueadoPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-[380px] rounded-[var(--radius-card)] border border-stroke bg-surface p-8 text-center shadow-[0_16px_48px_rgba(0,0,0,.5)]">
        <div className="display text-[22px] text-paper">Conta bloqueada</div>
        <p className="mt-2 text-[13px] text-mist">
          Seu acesso foi bloqueado por um administrador. Entre em contato para mais informações.
        </p>
        <form action={signOut} className="mt-6">
          <Button type="submit" variant="outline" className="w-full">
            Sair
          </Button>
        </form>
      </div>
    </div>
  );
}
