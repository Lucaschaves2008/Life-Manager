"use client";

import { InsightsFeed } from "@/components/desafios/insights-feed";
import { MembroMetasCard } from "@/components/desafios/membro-metas-card";
import { DesafioLeaderboard } from "@/components/desafios/desafio-leaderboard";
import { DesafioChat } from "@/components/desafios/desafio-chat";
import { DesafioDocumento } from "@/components/desafios/desafio-documento";
import { SolicitacoesCard } from "@/components/desafios/solicitacoes-card";
import type { DesafioDetalhe } from "@/lib/data/desafios";
import type { MensagemView } from "@/lib/data/desafios-chat";
import type { DesafioDocumentoView } from "@/lib/data/desafios-documento";
import type { SolicitacaoView } from "@/lib/data/desafios-solicitacoes";
import type { VariavelView } from "@/lib/data/variaveis";

export function DesafioDetalheClient({
  desafio,
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
            solicitacoesIniciais={solicitacoesIniciais}
          />
        )}
        <DesafioDocumento
          desafioId={desafio.id}
          viewerUserId={viewerUserId}
          isCriador={desafio.criadorId === viewerUserId}
          documentoInicial={documentoInicial}
        />
        {desafio.membros.length > 1 && <DesafioLeaderboard membros={desafio.membros} />}
        <InsightsFeed insights={desafio.insights} />
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
