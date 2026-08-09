"use client";

import { useEffect, useState } from "react";
import { DesafioEventosFeed } from "@/components/desafios/desafio-eventos-feed";
import { MembroMetasCard } from "@/components/desafios/membro-metas-card";
import { DesafioLeaderboard } from "@/components/desafios/desafio-leaderboard";
import { DesafioChat } from "@/components/desafios/desafio-chat";
import { DesafioDocumento } from "@/components/desafios/desafio-documento";
import { SolicitacoesCard } from "@/components/desafios/solicitacoes-card";
import { buscarDesafioDetalhe, buscarSolicitacoes } from "@/app/actions/desafios";
import type { DesafioDetalhe } from "@/lib/data/desafios";
import type { MensagemView } from "@/lib/data/desafios-chat";
import type { DesafioDocumentoView } from "@/lib/data/desafios-documento";
import type { SolicitacaoView } from "@/lib/data/desafios-solicitacoes";
import type { VariavelView } from "@/lib/data/variaveis";

const INTERVALO_POLL_MS = 6000;

export function DesafioDetalheClient({
  desafio: desafioInicial,
  viewerUserId,
  templatesChecklist,
  variaveis,
  mensagensIniciais,
  documentoInicial,
  solicitacoesIniciais,
  hoje,
}: {
  desafio: DesafioDetalhe;
  viewerUserId: string;
  templatesChecklist: { id: string; nome: string }[];
  variaveis: VariavelView[];
  mensagensIniciais: MensagemView[];
  documentoInicial: DesafioDocumentoView | null;
  solicitacoesIniciais: SolicitacaoView[];
  hoje: string;
}) {
  const [desafio, setDesafio] = useState(desafioInicial);
  const [solicitacoes, setSolicitacoes] = useState(solicitacoesIniciais);

  // Solicitações de edição são resolvidas por outro membro em outra aba: sem
  // polling aqui, quem pediu a mudança nunca vê a meta ou o status do pedido
  // atualizarem sozinhos e conclui (errado) que "aceitar não fez nada".
  useEffect(() => {
    let cancelado = false;
    const intervalo = setInterval(async () => {
      const [desafioNovo, solicitacoesNovas] = await Promise.all([
        buscarDesafioDetalhe(desafio.id),
        buscarSolicitacoes(desafio.id),
      ]);
      if (cancelado) return;
      if (desafioNovo) setDesafio(desafioNovo);
      setSolicitacoes(solicitacoesNovas);
    }, INTERVALO_POLL_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desafio.id]);

  const eu = desafio.membros.find((m) => m.userId === viewerUserId);
  const outros = desafio.membros.filter((m) => m.userId !== viewerUserId);
  const streakPorUsuario = new Map(desafio.membros.map((m) => [m.userId, m.streak]));
  // Sozinho no desafio não há o que combinar: as mudanças valem na hora.
  const precisaAprovacao = desafio.membros.length > 1;

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_360px] lg:items-start lg:gap-6">
      <div className="flex flex-col gap-6">
        {eu && (
          <MembroMetasCard
            desafioId={desafio.id}
            membro={eu}
            souEu
            metasGrandesLimite={desafio.metasGrandesLimite}
            precisaAprovacao={precisaAprovacao}
            templatesChecklist={templatesChecklist}
            variaveis={variaveis}
            hoje={hoje}
          />
        )}

        {outros.map((membro) => (
          <MembroMetasCard
            key={membro.userId}
            desafioId={desafio.id}
            membro={membro}
            souEu={false}
            metasGrandesLimite={desafio.metasGrandesLimite}
            precisaAprovacao={precisaAprovacao}
            templatesChecklist={templatesChecklist}
            variaveis={variaveis}
            hoje={hoje}
          />
        ))}
      </div>

      <div className="flex flex-col gap-6">
        {precisaAprovacao && (
          <SolicitacoesCard
            desafioId={desafio.id}
            solicitacoesIniciais={solicitacoes}
          />
        )}
        <DesafioDocumento
          desafioId={desafio.id}
          viewerUserId={viewerUserId}
          isCriador={desafio.criadorId === viewerUserId}
          documentoInicial={documentoInicial}
        />
        {desafio.membros.length > 1 && <DesafioLeaderboard membros={desafio.membros} />}
        <DesafioEventosFeed desafioId={desafio.id} eventos={desafio.eventos} />
        <DesafioChat
          desafioId={desafio.id}
          viewerUserId={viewerUserId}
          mensagensIniciais={mensagensIniciais}
          streakPorUsuario={streakPorUsuario}
        />
      </div>
    </div>
  );
}
