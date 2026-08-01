"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Rede de segurança do App Router. Sem este arquivo, qualquer exceção não
 * capturada (inclusive a rejeição de uma Server Action chamada sem try/catch)
 * desmontava a subárvore em silêncio: o conteúdo sumia da tela sem nenhuma
 * mensagem, e o usuário lia isso como "o banco não salvou".
 *
 * O caminho correto para falha de escrita continua sendo o useAcao(), que
 * mostra um toast e desfaz o otimismo sem derrubar a página. Aqui é só o
 * último recurso, e ele oferece reset() para o usuário se recuperar sozinho.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[erro-nao-tratado]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-stroke bg-surface-2">
        <AlertTriangle className="h-5 w-5 text-mist" strokeWidth={1.5} />
      </div>
      <p className="mt-4 text-[15px] text-ice">Alguma coisa quebrou aqui</p>
      <p className="mt-1.5 max-w-sm text-[13px] text-steel">
        O erro foi registrado. Se você estava salvando algo, o dado pode não ter sido
        gravado — confira depois de recarregar.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-[11px] text-steel">ref: {error.digest}</p>
      )}
      <Button variant="outline" size="sm" className="mt-5" onClick={reset}>
        <RotateCw className="h-3.5 w-3.5" strokeWidth={1.5} />
        Tentar de novo
      </Button>
    </div>
  );
}
