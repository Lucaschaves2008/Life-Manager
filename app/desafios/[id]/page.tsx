import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { CodigoConvite } from "@/components/desafios/codigo-convite";
import { DesafioDetalheClient } from "@/components/desafios/desafio-detalhe-client";
import { desafioDetalhe } from "@/lib/data/desafios";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;

  const souMembro = await db.desafioMembro.findUnique({
    where: { desafioId_userId: { desafioId: id, userId: user.id } },
  });
  if (!souMembro) notFound();

  const desafio = await desafioDetalhe(id);
  if (!desafio) notFound();

  const templates = await db.rotinaTemplate.findMany({
    where: { userId: user.id, ativo: true },
    select: { id: true, nome: true },
    orderBy: { ordem: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="card-in flex flex-wrap items-start justify-between gap-4 pt-2">
        <div>
          <Link
            href="/desafios"
            className="mb-2 inline-flex items-center gap-1 text-[12.5px] text-mist transition-colors hover:text-ice"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            Desafios
          </Link>
          <h1 className="display text-[28px] leading-none text-paper md:text-[32px]">
            {desafio.nome}
          </h1>
          {desafio.descricao && (
            <p className="mt-2 max-w-xl text-[13.5px] text-mist">{desafio.descricao}</p>
          )}
        </div>
      </header>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardLabel>Convite</CardLabel>
          <CodigoConvite codigo={desafio.codigo} />
        </div>
        <p className="mt-2 text-[12.5px] text-steel">
          Compartilhe este código para outras pessoas entrarem no desafio.
        </p>
      </Card>

      <DesafioDetalheClient
        desafio={desafio}
        viewerUserId={user.id}
        templatesChecklist={templates}
      />
    </div>
  );
}
