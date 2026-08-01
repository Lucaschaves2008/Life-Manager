import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Flame } from "@/components/caverna/flame";
import { CodigoConvite } from "@/components/desafios/codigo-convite";
import { DesafioDetalheClient } from "@/components/desafios/desafio-detalhe-client";
import { desafioDetalhe } from "@/lib/data/desafios";
import { mensagensDoDesafio } from "@/lib/data/desafios-chat";
import { documentoDoDesafio } from "@/lib/data/desafios-documento";
import { variaveisAtivas } from "@/lib/data/variaveis";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dayKeySP, nowSP } from "@/lib/dates";
import { initials } from "@/lib/utils";

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

  const [templates, variaveis, mensagensIniciais, documento] = await Promise.all([
    db.rotinaTemplate.findMany({
      where: { userId: user.id, ativo: true },
      select: { id: true, nome: true },
      orderBy: { ordem: "asc" },
    }),
    variaveisAtivas(user.id),
    mensagensDoDesafio(id),
    documentoDoDesafio(id),
  ]);

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

          <div className="mt-4 flex -space-x-2.5">
            {desafio.membros.map((m) => (
              <div key={m.userId} className="relative" title={m.nome ?? "Sem nome"}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--color-bg)] bg-surface-2 text-[11.5px] text-mist">
                  {initials(m.nome, "?")}
                </div>
                {m.streak > 0 && (
                  <Flame streak={m.streak} size={16} className="absolute -bottom-1 -right-1" animate={false} />
                )}
              </div>
            ))}
          </div>
        </div>

        <CodigoConvite codigo={desafio.codigo} />
      </header>

      <DesafioDetalheClient
        desafio={desafio}
        viewerUserId={user.id}
        templatesChecklist={templates}
        variaveis={variaveis}
        mensagensIniciais={mensagensIniciais}
        documentoInicial={documento}
        hoje={dayKeySP(nowSP())}
      />
    </div>
  );
}
