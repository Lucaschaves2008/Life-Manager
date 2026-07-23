"use client";

import { InsightsFeed } from "@/components/desafios/insights-feed";
import { MembroMetasCard } from "@/components/desafios/membro-metas-card";
import type { DesafioDetalhe } from "@/lib/data/desafios";

export function DesafioDetalheClient({
  desafio,
  viewerUserId,
  templatesChecklist,
}: {
  desafio: DesafioDetalhe;
  viewerUserId: string;
  templatesChecklist: { id: string; nome: string }[];
}) {
  const eu = desafio.membros.find((m) => m.userId === viewerUserId);
  const outros = desafio.membros.filter((m) => m.userId !== viewerUserId);

  return (
    <div className="flex flex-col gap-6">
      <InsightsFeed insights={desafio.insights} />

      {eu && (
        <MembroMetasCard
          desafioId={desafio.id}
          membro={eu}
          souEu
          metasGrandesLimite={desafio.metasGrandesLimite}
          templatesChecklist={templatesChecklist}
        />
      )}

      {outros.map((membro) => (
        <MembroMetasCard
          key={membro.userId}
          desafioId={desafio.id}
          membro={membro}
          souEu={false}
          metasGrandesLimite={desafio.metasGrandesLimite}
          templatesChecklist={templatesChecklist}
        />
      ))}
    </div>
  );
}
