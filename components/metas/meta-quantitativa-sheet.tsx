"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  criarMetaQuantitativa,
  editarMetaQuantitativa,
  type MetaQuantitativaInput,
} from "@/app/actions/metas-quantitativas";
import {
  METRICAS,
  PERIODOS,
  type MetaMetrica,
  type MetaPeriodo,
} from "@/lib/data/metas-quantitativas";
import { monthKeySP, nowSP, quarterKeySP, yearKeySP } from "@/lib/dates";

export type MetaQuantitativaEditavel = {
  id: string;
  titulo: string;
  metrica: MetaMetrica;
  alvo: number;
  periodo: MetaPeriodo;
  chave: string;
};

function chaveAtual(periodo: MetaPeriodo): string {
  const agora = nowSP();
  if (periodo === "mes") return monthKeySP(agora);
  if (periodo === "trimestre") return quarterKeySP(agora);
  return yearKeySP(agora);
}

export function MetaQuantitativaSheet({
  open,
  onOpenChange,
  editando,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editando?: MetaQuantitativaEditavel | null;
}) {
  const [pending, startTransition] = useTransition();
  const [titulo, setTitulo] = useState(editando?.titulo ?? "");
  const [metrica, setMetrica] = useState<MetaMetrica>(editando?.metrica ?? "treinos");
  const [alvo, setAlvo] = useState(editando?.alvo ?? 0);
  const [periodo, setPeriodo] = useState<MetaPeriodo>(editando?.periodo ?? "mes");

  const metricaInfo = METRICAS.find((m) => m.value === metrica)!;
  const valido = titulo.trim().length > 0 && alvo > 0;

  function salvar() {
    const payload: MetaQuantitativaInput = {
      titulo: titulo.trim(),
      metrica,
      alvo,
      periodo,
      chave: editando?.chave ?? chaveAtual(periodo),
    };

    startTransition(async () => {
      if (editando) {
        await editarMetaQuantitativa(editando.id, payload);
        toast.success("Meta atualizada");
      } else {
        await criarMetaQuantitativa(payload);
        toast.success("Meta criada");
      }
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>{editando ? "Editar meta" : "Nova meta quantitativa"}</SheetTitle>

        <div className="mt-6 flex flex-col gap-5">
          <div>
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: 75 treinos no trimestre"
            />
          </div>

          <div>
            <Label>Métrica</Label>
            <Select
              value={metrica}
              onValueChange={(v) => setMetrica(v as MetaMetrica)}
              disabled={!!editando}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRICAS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="alvo">Alvo ({metricaInfo.unidade})</Label>
              <Input
                id="alvo"
                type="number"
                min={0}
                step="any"
                value={alvo || ""}
                onChange={(e) => setAlvo(Number(e.target.value) || 0)}
                placeholder={metricaInfo.placeholder}
                className="tabular"
              />
            </div>
            <div>
              <Label>Período</Label>
              <Select
                value={periodo}
                onValueChange={(v) => setPeriodo(v as MetaPeriodo)}
                disabled={!!editando}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODOS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-1 flex items-center gap-3">
            <Button variant="primary" onClick={salvar} disabled={!valido || pending}>
              {pending ? "Salvando…" : editando ? "Salvar" : "Criar meta"}
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
