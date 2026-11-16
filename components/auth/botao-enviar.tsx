"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** Submit com estado de carregamento — sem ele o clique parecia não fazer nada. */
export function BotaoEnviar({ children, pendente }: { children: React.ReactNode; pendente: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      size="md"
      disabled={pending}
      aria-busy={pending}
      className="w-full !h-10.5 mt-2 disabled:opacity-70"
    >
      {pending ? pendente : children}
    </Button>
  );
}
