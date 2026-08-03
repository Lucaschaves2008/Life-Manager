"use client";

import { useState } from "react";
import { useAcao } from "@/lib/acao-cliente";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { solicitarAjusteProgresso } from "@/app/actions/desafios";
import { cn } from "@/lib/utils";
import type { DesafioMetaView } from "@/lib/data/desafios";

/**
 * Registro retroativo de progresso: o treino que a pessoa fez e esqueceu de
 * marcar (ou algo lançado a mais que precisa sair). Num desafio com mais de um
 * membro isso vira pedido — o grupo inteiro precisa aprovar.
 */
export function AjusteProgressoSheet({
  open,
  onOpenChange,
  meta,
  precisaAprovacao,
  hoje,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  meta: DesafioMetaView;
  precisaAprovacao: boolean;
  hoje: string;
}) {
  const [pending, executar] = useAcao();
  const [direcao, setDirecao] = useState<"adicionar" | "tirar">("adicionar");
  const [quantidade, setQuantidade] = useState(1);
  const [data, setData] = useState(hoje);
  const [motivo, setMotivo] = useState("");

  const valido = quantidade > 0 && motivo.trim().length > 0;

  function salvar() {
    executar(async () => {
      try {
        const resultado = await solicitarAjusteProgresso(meta.id, {
          quantidade: direcao === "adicionar" ? quantidade : -quantidade,
          data,
          motivo,
        });
        toast.success(
          resultado.aplicado
            ? "Progresso ajustado"
            : "Pedido enviado — o ajuste só conta quando todos aprovarem"
        );
        onOpenChange(false);
        setMotivo("");
        setQuantidade(1);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao pedir o ajuste");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>Ajustar progresso</SheetTitle>
        <p className="mt-2 text-[12.5px] text-steel">
          {meta.titulo} · hoje em {meta.atual % 1 === 0 ? meta.atual : meta.atual.toFixed(1)}{" "}
          {meta.unidade}
        </p>

        {precisaAprovacao && (
          <p className="mt-4 rounded-[12px] border border-stroke bg-surface-2 px-3.5 py-3 text-[12.5px] text-mist">
            Mexer no próprio placar precisa do aval do grupo: o ajuste só conta
            quando <span className="text-ice">todos aprovarem</span>.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-5">
          <div className="flex gap-1.5 rounded-full border border-stroke bg-surface-2 p-1">
            {(
              [
                { value: "adicionar", label: "Adicionar" },
                { value: "tirar", label: "Tirar" },
              ] as const
            ).map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDirecao(d.value)}
                className={cn(
                  "flex-1 rounded-full py-1.5 text-[12.5px] transition-colors",
                  direcao === d.value ? "bg-elevated text-ice" : "text-steel hover:text-mist"
                )}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ajuste-qtd">Quanto ({meta.unidade || "unidades"})</Label>
              <Input
                id="ajuste-qtd"
                type="number"
                min={0}
                step="any"
                value={quantidade || ""}
                onChange={(e) => setQuantidade(Number(e.target.value))}
                onFocus={(e) => e.target.select()}
                className="tabular"
              />
            </div>
            <div>
              <Label htmlFor="ajuste-data">Dia</Label>
              <Input
                id="ajuste-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="tabular"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="ajuste-motivo">Motivo</Label>
            <Input
              id="ajuste-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: treinei na quinta e esqueci de marcar"
            />
            <p className="mt-1.5 text-[11.5px] text-steel">
              O ajuste vale só dentro deste desafio — não cria treino, check nem
              lançamento nos outros módulos.
            </p>
          </div>

          <Button variant="primary" disabled={!valido || pending} onClick={salvar} className="mt-1.5">
            {precisaAprovacao ? "Enviar pedido ao grupo" : "Ajustar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
