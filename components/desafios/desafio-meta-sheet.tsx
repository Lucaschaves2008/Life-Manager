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
import { criarMetaGrande, criarMetaPequena, type DesafioMetaInput } from "@/app/actions/desafios";
import { PERIODOS_DESAFIO, type DesafioOrigem, type DesafioPeriodo } from "@/lib/data/desafios";
import { METRICAS, type MetaMetrica } from "@/lib/data/metas-quantitativas";

export function DesafioMetaSheet({
  open,
  onOpenChange,
  desafioId,
  tipo,
  metaPaiId,
  templatesChecklist,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  desafioId: string;
  tipo: "grande" | "pequena";
  metaPaiId?: string;
  templatesChecklist: { id: string; nome: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [titulo, setTitulo] = useState("");
  const [origem, setOrigem] = useState<DesafioOrigem>("metrica");
  const [metrica, setMetrica] = useState<MetaMetrica>("treinos");
  const [rotinaTemplateId, setRotinaTemplateId] = useState<string>("");
  const [alvo, setAlvo] = useState(0);
  const [periodo, setPeriodo] = useState<DesafioPeriodo>(tipo === "grande" ? "trimestre" : "mes");

  const valido =
    titulo.trim().length > 0 &&
    alvo > 0 &&
    (origem === "metrica" || (origem === "checklist" && rotinaTemplateId !== ""));

  function fechar() {
    onOpenChange(false);
    setTitulo("");
    setAlvo(0);
    setRotinaTemplateId("");
  }

  function salvar() {
    const payload: DesafioMetaInput = {
      titulo,
      origem,
      metrica: origem === "metrica" ? metrica : undefined,
      rotinaTemplateId: origem === "checklist" ? rotinaTemplateId : undefined,
      alvo,
      periodo,
    };

    startTransition(async () => {
      try {
        if (tipo === "grande") {
          await criarMetaGrande(desafioId, payload);
        } else if (metaPaiId) {
          await criarMetaPequena(desafioId, metaPaiId, payload);
        }
        toast.success("Meta criada");
        fechar();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao criar meta");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>{tipo === "grande" ? "Nova meta grande" : "Nova meta menor"}</SheetTitle>

        <div className="mt-6 flex flex-col gap-5">
          <div>
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={tipo === "grande" ? "Ex.: Bom shape" : "Ex.: 10 treinos no mês"}
            />
          </div>

          <div>
            <Label>Origem do progresso</Label>
            <Select value={origem} onValueChange={(v) => setOrigem(v as DesafioOrigem)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="metrica">Métrica automática</SelectItem>
                <SelectItem value="checklist">Item do meu checklist</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {origem === "metrica" && (
            <div>
              <Label>Métrica</Label>
              <Select value={metrica} onValueChange={(v) => setMetrica(v as MetaMetrica)}>
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
          )}

          {origem === "checklist" && (
            <div>
              <Label>Item do checklist</Label>
              {templatesChecklist.length === 0 ? (
                <p className="text-[12px] text-steel">Você não tem itens no checklist ainda.</p>
              ) : (
                <Select value={rotinaTemplateId} onValueChange={setRotinaTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolher item" />
                  </SelectTrigger>
                  <SelectContent>
                    {templatesChecklist.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="alvo">Alvo</Label>
            <Input
              id="alvo"
              type="number"
              min={0}
              value={alvo || ""}
              onChange={(e) => setAlvo(Number(e.target.value))}
              placeholder="Ex.: 10"
            />
          </div>

          <div>
            <Label>Período</Label>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as DesafioPeriodo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODOS_DESAFIO.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="primary" disabled={!valido || pending} onClick={salvar} className="mt-1.5">
            Salvar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
