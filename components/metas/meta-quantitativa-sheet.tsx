"use client";

import { useState } from "react";
import { useAcao } from "@/lib/acao-cliente";
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
  type MetaOrigem,
  type MetaPeriodo,
} from "@/lib/data/metas-quantitativas-constantes";
import type { VariavelView } from "@/lib/data/variaveis";
import { monthKeySP, nowSP, quarterKeySP, yearKeySP } from "@/lib/dates";

export type MetaQuantitativaEditavel = {
  id: string;
  titulo: string;
  origem: MetaOrigem;
  metrica: MetaMetrica | null;
  variavelId: string | null;
  alvo: number;
  periodo: MetaPeriodo;
  chave: string;
};

function chaveAtual(periodo: MetaPeriodo): string {
  const agora = nowSP();
  if (periodo === "mes" || periodo === "trimestre_movel") return monthKeySP(agora);
  if (periodo === "trimestre") return quarterKeySP(agora);
  return yearKeySP(agora);
}

export function MetaQuantitativaSheet({
  open,
  onOpenChange,
  editando,
  variaveis,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editando?: MetaQuantitativaEditavel | null;
  variaveis: VariavelView[];
}) {
  const [pending, executar] = useAcao();
  const [titulo, setTitulo] = useState(editando?.titulo ?? "");
  const [origem, setOrigem] = useState<MetaOrigem>(editando?.origem ?? "metrica");
  const [metrica, setMetrica] = useState<MetaMetrica>(editando?.metrica ?? "treinos");
  const [variavelId, setVariavelId] = useState(editando?.variavelId ?? variaveis[0]?.id ?? "");
  const [alvo, setAlvo] = useState(editando?.alvo ?? 0);
  const [periodo, setPeriodo] = useState<MetaPeriodo>(editando?.periodo ?? "mes");

  const metricaInfo = METRICAS.find((m) => m.value === metrica)!;
  const variavelInfo = variaveis.find((v) => v.id === variavelId);
  const valido =
    titulo.trim().length > 0 &&
    alvo > 0 &&
    (origem === "metrica" || (origem === "variavel" && !!variavelId));

  function salvar() {
    const payload: MetaQuantitativaInput = {
      titulo: titulo.trim(),
      origem,
      metrica: origem === "metrica" ? metrica : null,
      variavelId: origem === "variavel" ? variavelId : null,
      alvo,
      periodo,
      chave: editando?.chave ?? chaveAtual(periodo),
    };

    executar(async () => {
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
            <Label>Origem do progresso</Label>
            <Select
              value={origem}
              onValueChange={(v) => setOrigem(v as MetaOrigem)}
              disabled={!!editando}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="metrica">Métrica automática</SelectItem>
                <SelectItem value="variavel">Variável pessoal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {origem === "metrica" ? (
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
          ) : (
            <div>
              <Label>Variável</Label>
              {variaveis.length === 0 ? (
                <p className="text-[12.5px] text-steel">
                  Crie uma variável no checklist (tipo &quot;Variável&quot;) para usar aqui.
                </p>
              ) : (
                <Select value={variavelId} onValueChange={setVariavelId} disabled={!!editando}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {variaveis.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.emoji} {v.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="alvo">
                Alvo ({origem === "metrica" ? metricaInfo.unidade : `dias · ${variavelInfo?.nome ?? ""}`})
              </Label>
              <Input
                id="alvo"
                type="number"
                min={0}
                step="any"
                value={alvo || ""}
                onChange={(e) => setAlvo(Number(e.target.value) || 0)}
                onFocus={(e) => e.target.select()}
                placeholder={origem === "metrica" ? metricaInfo.placeholder : "Ex.: 10"}
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
