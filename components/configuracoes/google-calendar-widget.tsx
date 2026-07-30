"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Card, CardLabel } from "@/components/caverna/card";
import { Button } from "@/components/ui/button";
import {
  getGoogleAuthUrl,
  disconnectGoogleCalendar,
} from "@/app/actions/google-calendar";
import { toast } from "sonner";

export function GoogleCalendarWidget() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const googleConnected = searchParams.get("google_connected");
    const googleError = searchParams.get("google_error");

    if (googleConnected === "true") {
      toast.success("Google Calendar conectado com sucesso!");
      setIsConnected(true);
      router.push("/configuracoes");
    }

    if (googleError) {
      const erroMapa: Record<string, string> = {
        access_denied: "Você negou o acesso.",
        no_code: "Código de autorização não recebido.",
        callback_failed: "Erro ao processar autorização.",
      };
      toast.error(erroMapa[googleError] || `Erro: ${googleError}`);
      router.push("/configuracoes");
    }
  }, [searchParams, router]);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const authUrl = await getGoogleAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      toast.error("Erro ao conectar Google Calendar");
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Desconectar Google Calendar? Seus eventos locais não serão deletados.")) return;

    setIsLoading(true);
    try {
      await disconnectGoogleCalendar();
      setIsConnected(false);
      toast.success("Google Calendar desconectado");
      router.refresh();
    } catch (error) {
      toast.error("Erro ao desconectar");
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <CardLabel>Google Calendar</CardLabel>
        <p className="mt-1 text-sm text-mist">
          {isConnected
            ? "Seus eventos estão sendo sincronizados com Google Calendar."
            : "Sincronize sua agenda com Google Calendar."}
        </p>
      </div>
      {isConnected ? (
        <Button
          onClick={handleDisconnect}
          disabled={isLoading}
          variant="outline"
          size="sm"
        >
          {isLoading ? "Desconectando..." : "Desconectar"}
        </Button>
      ) : (
        <Button
          onClick={handleConnect}
          disabled={isLoading}
          size="sm"
        >
          {isLoading ? "Conectando..." : "Conectar"}
        </Button>
      )}
    </Card>
  );
}
