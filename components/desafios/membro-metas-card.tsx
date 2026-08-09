"use client";

import { useState } from "react";
import { useAcao } from "@/lib/acao-cliente";
import { Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardLabel } from "@/components/caverna/card";
import { LancarDinheiro } from "@/components/caverna/lancar-dinheiro";
import { Sparkline } from "@/components/caverna/sparkline";
import { Button } from "@/components/ui/button";
import { AjusteProgressoSheet } from "@/components/desafios/ajuste-progresso-sheet";
import { DesafioMetaSheet } from "@/components/desafios/desafio-meta-sheet";
import { VincularChecklistSelect } from "@/components/desafios/vincular-checklist-select";
import { excluirMeta } from "@/app/actions/desafios";
import { cn, initials } from "@/lib/utils";
import { Flame } from "@/components/caverna/flame";
import type { DesafioMetaView, MembroDesafio } from "@/lib/data/desafios";
import type { VariavelView } from "@/lib/data/variaveis";

function formatNumero(v: number): string {
  return v % 1 === 0 ? v.toFixed(0) : v.toFixed(1);
}

/** Toast que deixa claro se a mudança valeu na hora ou virou pedido no grupo. */
function toastMudanca(aplicado: boolean, textoAplicado: string) {
  toast.success(
    aplicado ? textoAplicado : "Pedido enviado — só vale quando todos aprovarem"
  );
}

function MetaPequenaRow({
  meta,
  souDono,
  precisaAprovacao,
  templatesChecklist,
  variaveis,
  desafioId,
  hoje,
}: {
  meta: DesafioMetaView;
  souDono: boolean;
  precisaAprovacao: boolean;
  templatesChecklist: { id: string; nome: string }[];
  variaveis: VariavelView[];
  desafioId: string;
  hoje: string;
}) {
  const [, executar] = useAcao();
  const [removendo, setRemovendo] = useState(false);
  const [editando, setEditando] = useState(false);
  const [ajustando, setAjustando] = useState(false);

  return (
    <div
      className={cn(
        "group rounded-[12px] border border-stroke bg-surface-2/40 px-3.5 py-3 transition-opacity",
        removendo && "opacity-40"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] text-ice">{meta.titulo}</p>
          <p className="mt-0.5 text-[11px] text-steel">
            {formatNumero(meta.atual)}/{formatNumero(meta.alvo)} {meta.unidade} · {meta.periodo}
          </p>
        </div>
        {souDono && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              aria-label="Ajustar progresso"
              onClick={() => setAjustando(true)}
              className="rounded-md p-1 text-steel transition-colors hover:text-ice"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <button
              aria-label="Editar meta"
              onClick={() => setEditando(true)}
              className="rounded-md p-1 text-steel transition-colors hover:text-ice"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <button
              aria-label="Excluir meta"
              onClick={() => {
                setRemovendo(true);
                executar(async () => {
                  try {
                    const r = await excluirMeta(meta.id);
                    toastMudanca(r.aplicado, "Meta excluída");
                    if (!r.aplicado) setRemovendo(false);
                  } catch (e) {
                    setRemovendo(false);
                    toast.error(e instanceof Error ? e.message : "Erro ao excluir");
                  }
                });
              }}
              className="rounded-md p-1 text-steel transition-colors hover:text-coral"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      {souDono && editando && (
        <DesafioMetaSheet
          open={editando}
          onOpenChange={setEditando}
          desafioId={desafioId}
          tipo="pequena"
          editando={meta}
          precisaAprovacao={precisaAprovacao}
          templatesChecklist={templatesChecklist}
          variaveis={variaveis}
        />
      )}
      {souDono && ajustando && (
        <AjusteProgressoSheet
          open={ajustando}
          onOpenChange={setAjustando}
          meta={meta}
          precisaAprovacao={precisaAprovacao}
          hoje={hoje}
        />
      )}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${Math.max(0, Math.min(100, meta.pct))}%`,
            background: meta.pct >= 100 ? "var(--color-mint)" : "var(--color-steel)",
          }}
        />
      </div>
    </div>
  );
}

function MetaGrandeBlock({
  desafioId,
  meta,
  souDono,
  precisaAprovacao,
  templatesChecklist,
  variaveis,
  hoje,
}: {
  desafioId: string;
  meta: DesafioMetaView;
  souDono: boolean;
  precisaAprovacao: boolean;
  templatesChecklist: { id: string; nome: string }[];
  variaveis: VariavelView[];
  hoje: string;
}) {
  const [, executar] = useAcao();
  const [removendo, setRemovendo] = useState(false);
  const [sheetAberto, setSheetAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [ajustando, setAjustando] = useState(false);
  const cor = meta.pct >= 100 ? "var(--color-mint)" : "var(--color-ice)";
  // Meta com filhas soma o progresso delas — o ajuste tem que ser feito na filha.
  const podeAjustar = meta.filhas.length === 0;

  return (
    <div className={cn("rounded-[14px] border border-stroke bg-surface px-4 py-3.5", removendo && "opacity-40")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] text-ice">{meta.titulo}</p>
          <p className="mt-0.5 text-[11.5px] text-steel">
            {formatNumero(meta.atual)}/{formatNumero(meta.alvo)} {meta.unidade} · {meta.periodo}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "tabular rounded-full px-2 py-0.5 text-[11px] font-medium",
              meta.pct >= 100 ? "bg-mint-soft text-mint" : "bg-surface-2 text-mist"
            )}
          >
            {Math.round(meta.pct)}%
          </span>
          {souDono && (
            <>
              {podeAjustar && (
                <button
                  aria-label="Ajustar progresso"
                  onClick={() => setAjustando(true)}
                  className="rounded-md p-1 text-steel transition-colors hover:text-ice"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              )}
              <button
                aria-label="Editar meta"
                onClick={() => setEditando(true)}
                className="rounded-md p-1 text-steel transition-colors hover:text-ice"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
              <button
                aria-label="Excluir meta"
                onClick={() => {
                  setRemovendo(true);
                  executar(async () => {
                    try {
                      const r = await excluirMeta(meta.id);
                      toastMudanca(r.aplicado, "Meta excluída");
                      if (!r.aplicado) setRemovendo(false);
                    } catch (e) {
                      setRemovendo(false);
                      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
                    }
                  });
                }}
                className="rounded-md p-1 text-steel transition-colors hover:text-coral"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </>
          )}
        </div>
      </div>

      {souDono && editando && (
        <DesafioMetaSheet
          open={editando}
          onOpenChange={setEditando}
          desafioId={desafioId}
          tipo="grande"
          editando={meta}
          precisaAprovacao={precisaAprovacao}
          templatesChecklist={templatesChecklist}
          variaveis={variaveis}
        />
      )}
      {souDono && ajustando && (
        <AjusteProgressoSheet
          open={ajustando}
          onOpenChange={setAjustando}
          meta={meta}
          precisaAprovacao={precisaAprovacao}
          hoje={hoje}
        />
      )}

      <div className="mt-3">
        <Sparkline serie={meta.serie} cor={cor} />
      </div>

      {souDono && meta.metrica === "dinheiro" && (
        <div className="mt-3">
          <LancarDinheiro hoje={hoje} />
        </div>
      )}

      {souDono && meta.origem === "checklist" && (
        <div className="mt-3">
          <VincularChecklistSelect
            metaId={meta.id}
            rotinaTemplateIdAtual={meta.rotinaTemplateId}
            templatesChecklist={templatesChecklist}
            metaAtual={{
              titulo: meta.titulo,
              origem: meta.origem,
              metrica: meta.metrica ?? undefined,
              alvo: meta.alvo,
              periodo: meta.periodo,
              dificuldade: meta.dificuldade,
            }}
          />
        </div>
      )}

      {meta.filhas.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {meta.filhas.map((filha) => (
            <MetaPequenaRow
              key={filha.id}
              meta={filha}
              souDono={souDono}
              precisaAprovacao={precisaAprovacao}
              templatesChecklist={templatesChecklist}
              variaveis={variaveis}
              desafioId={desafioId}
              hoje={hoje}
            />
          ))}
        </div>
      )}

      {souDono && (
        <>
          <Button variant="dashed" size="sm" onClick={() => setSheetAberto(true)} className="mt-3 w-full">
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Meta menor
          </Button>
          <DesafioMetaSheet
            open={sheetAberto}
            onOpenChange={setSheetAberto}
            desafioId={desafioId}
            tipo="pequena"
            metaPaiId={meta.id}
            precisaAprovacao={precisaAprovacao}
            templatesChecklist={templatesChecklist}
            variaveis={variaveis}
          />
        </>
      )}
    </div>
  );
}

export function MembroMetasCard({
  desafioId,
  membro,
  souEu,
  metasGrandesLimite,
  precisaAprovacao,
  templatesChecklist,
  variaveis,
  hoje,
}: {
  desafioId: string;
  membro: MembroDesafio;
  souEu: boolean;
  metasGrandesLimite: number;
  /** Desafio com mais de um membro: mudanças viram pedido de aprovação. */
  precisaAprovacao: boolean;
  templatesChecklist: { id: string; nome: string }[];
  variaveis: VariavelView[];
  hoje: string;
}) {
  const [sheetAberto, setSheetAberto] = useState(false);
  const atingiuLimite = membro.metasGrandes.length >= metasGrandesLimite;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-[11.5px] text-mist">
              {initials(membro.nome, "?")}
            </div>
            {membro.streak > 0 && (
              <Flame streak={membro.streak} size={18} className="absolute -bottom-1.5 -right-1.5" />
            )}
          </div>
          <div>
            <CardLabel className="text-ice">{souEu ? "Minhas metas" : (membro.nome ?? "Sem nome")}</CardLabel>
            {membro.streak > 0 && (
              <p className="tabular mt-0.5 text-[11px] text-amber">{membro.streak}d de ofensiva</p>
            )}
          </div>
        </div>
        <span className="tabular text-[11.5px] text-steel">
          {membro.metasGrandes.length}/{metasGrandesLimite}
        </span>
      </div>

      {membro.metasGrandes.length === 0 && (
        <p className="mt-4 text-[13px] text-steel">
          {souEu ? "Você ainda não criou nenhuma meta grande." : "Ainda não criou metas."}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {membro.metasGrandes.map((meta) => (
          <MetaGrandeBlock
            key={meta.id}
            desafioId={desafioId}
            meta={meta}
            souDono={souEu}
            precisaAprovacao={precisaAprovacao}
            templatesChecklist={templatesChecklist}
            variaveis={variaveis}
            hoje={hoje}
          />
        ))}
      </div>

      {souEu && !atingiuLimite && (
        <>
          <Button variant="dashed" size="sm" onClick={() => setSheetAberto(true)} className="mt-3 w-full">
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Nova meta grande
          </Button>
          <DesafioMetaSheet
            open={sheetAberto}
            onOpenChange={setSheetAberto}
            desafioId={desafioId}
            tipo="grande"
            precisaAprovacao={precisaAprovacao}
            templatesChecklist={templatesChecklist}
            variaveis={variaveis}
          />
        </>
      )}
    </Card>
  );
}
