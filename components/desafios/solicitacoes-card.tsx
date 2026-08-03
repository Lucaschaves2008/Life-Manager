"use client";

import { useState } from "react";
import { useAcao } from "@/lib/acao-cliente";
import { Check, Handshake, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardLabel } from "@/components/caverna/card";
import { EmptyState } from "@/components/caverna/empty-state";
import { Button } from "@/components/ui/button";
import {
  buscarSolicitacoes,
  cancelarSolicitacao,
  votarSolicitacao,
} from "@/app/actions/desafios";
import {
  ROTULO_TIPO_SOLICITACAO,
  type SolicitacaoStatus,
  type SolicitacaoView,
} from "@/lib/data/desafios-solicitacoes";
import { cn } from "@/lib/utils";

const rotuloStatus: Record<SolicitacaoStatus, string> = {
  pendente: "Aguardando",
  aprovada: "Aprovada por todos",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

const corStatus: Record<SolicitacaoStatus, string> = {
  pendente: "bg-surface-2 text-mist",
  aprovada: "bg-mint-soft text-mint",
  recusada: "bg-surface-2 text-coral",
  cancelada: "bg-surface-2 text-steel",
};

function dataCurta(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function LinhaSolicitacao({
  s,
  desafioId,
  onMudou,
}: {
  s: SolicitacaoView;
  desafioId: string;
  onMudou: (lista: SolicitacaoView[]) => void;
}) {
  const [pending, executar] = useAcao();
  const pendente = s.status === "pendente";

  function agir(fn: () => Promise<unknown>, sucesso: string) {
    executar(async () => {
      try {
        await fn();
        toast.success(sucesso);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível registrar seu voto");
      }
      // Recarrega a lista mesmo depois de erro: a aplicação pode ter falhado
      // já com o pedido encerrado, e a tela precisa mostrar isso.
      try {
        onMudou(await buscarSolicitacoes(desafioId));
      } catch {
        // lista desatualizada não justifica quebrar a tela
      }
    });
  }

  return (
    <div className="border-b border-stroke py-3 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-steel">
            {ROTULO_TIPO_SOLICITACAO[s.tipo]} · {s.autorNome} · {dataCurta(s.criadoEm)}
          </p>
          <p className="mt-1 text-[12.5px] leading-snug text-ice">{s.resumo}</p>
          {s.justificativa && (
            <p className="mt-1 text-[11.5px] leading-snug text-mist">
              &ldquo;{s.justificativa}&rdquo;
            </p>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
            corStatus[s.status]
          )}
        >
          {rotuloStatus[s.status]}
        </span>
      </div>

      {pendente && (
        <>
          <p className="tabular mt-2 text-[11px] text-steel">
            {s.aprovacoes}/{s.totalMembros} aprovaram
            {s.faltamVotar.length > 0 && ` · falta ${s.faltamVotar.join(", ")}`}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {s.meuVoto === null && (
              <>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={pending}
                  onClick={() =>
                    agir(() => votarSolicitacao(s.id, true), "Você aprovou a mudança")
                  }
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    agir(() => votarSolicitacao(s.id, false), "Pedido recusado")
                  }
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Recusar
                </Button>
              </>
            )}
            {s.meuVoto === true && !s.souAutor && (
              <span className="text-[11.5px] text-mint">Você aprovou</span>
            )}
            {s.souAutor && (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => agir(() => cancelarSolicitacao(s.id), "Pedido cancelado")}
              >
                Cancelar pedido
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function SolicitacoesCard({
  desafioId,
  solicitacoesIniciais,
}: {
  desafioId: string;
  solicitacoesIniciais: SolicitacaoView[];
}) {
  const [solicitacoes, setSolicitacoes] = useState(solicitacoesIniciais);
  // A action revalida a rota e o servidor manda a lista nova; sem isto o
  // estado local continuaria mostrando o pedido antigo.
  const [ultimoDoServidor, setUltimoDoServidor] = useState(solicitacoesIniciais);
  if (ultimoDoServidor !== solicitacoesIniciais) {
    setUltimoDoServidor(solicitacoesIniciais);
    setSolicitacoes(solicitacoesIniciais);
  }

  const pendentes = solicitacoes.filter((s) => s.status === "pendente");
  const historico = solicitacoes.filter((s) => s.status !== "pendente");
  const [verHistorico, setVerHistorico] = useState(false);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardLabel>Mudanças nas metas</CardLabel>
        {pendentes.length > 0 && (
          <span className="tabular rounded-full bg-amber-soft px-2 py-0.5 text-[11px] font-medium text-amber">
            {pendentes.length} pendente{pendentes.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {pendentes.length === 0 ? (
        <div className="mt-2">
          <EmptyState
            icon={Handshake}
            variant="inline"
            title="Nenhum pedido em aberto"
            description="Toda mudança de meta ou ajuste de progresso passa por aqui e só vale com a aprovação de todos."
          />
        </div>
      ) : (
        <div className="mt-2 flex flex-col">
          {pendentes.map((s) => (
            <LinhaSolicitacao
              key={s.id}
              s={s}
              desafioId={desafioId}
              onMudou={setSolicitacoes}
            />
          ))}
        </div>
      )}

      {historico.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setVerHistorico((v) => !v)}
            className="mt-3 text-[11.5px] text-steel transition-colors hover:text-mist"
          >
            {verHistorico ? "Esconder histórico" : `Ver histórico (${historico.length})`}
          </button>
          {verHistorico && (
            <div className="mt-1 flex flex-col">
              {historico.map((s) => (
                <LinhaSolicitacao
              key={s.id}
              s={s}
              desafioId={desafioId}
              onMudou={setSolicitacoes}
            />
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
