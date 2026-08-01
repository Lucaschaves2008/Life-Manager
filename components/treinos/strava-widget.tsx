"use client";


import { useAcao } from "@/lib/acao-cliente";
import { Link2, RefreshCw, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DotsMenu } from "@/components/caverna/dots-menu";
import { desconectarStrava, sincronizarStrava } from "@/app/actions/strava";
import { cn } from "@/lib/utils";

export function StravaWidget({
  configurado,
  conectado,
  authorizeUrl,
}: {
  configurado: boolean;
  conectado: boolean;
  authorizeUrl: string | null;
}) {
  const [pending, executar] = useAcao();

  if (!configurado) {
    return (
      <p className="text-[12px] text-steel sm:max-w-[220px] sm:text-right">
        Integração não configurada (defina STRAVA_CLIENT_ID/SECRET).
      </p>
    );
  }

  if (!conectado) {
    return (
      <a href={authorizeUrl ?? "#"}>
        <Button variant="soft" size="sm">
          <Link2 className="h-4 w-4" strokeWidth={1.5} />
          Conectar Strava
        </Button>
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          executar(async () => {
            const n = await sincronizarStrava();
            toast.success(n > 0 ? `${n} corrida(s) importada(s) do Strava` : "Tudo sincronizado");
          })
        }
      >
        <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} strokeWidth={1.5} />
        Sincronizar Strava
      </Button>
      <DotsMenu
        items={[
          {
            label: "Desconectar Strava",
            icon: Unlink,
            destructive: true,
            onSelect: () =>
              executar(async () => {
                await desconectarStrava();
                toast.success("Strava desconectado");
              }),
          },
        ]}
      />
    </div>
  );
}
