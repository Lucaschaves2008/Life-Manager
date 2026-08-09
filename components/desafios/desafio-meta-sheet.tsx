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
import { Segmented } from "@/components/caverna/segmented";
import {
  criarMetaGrande,
  criarMetaPequena,
  editarMeta,
  type DesafioMetaInput,
} from "@/app/actions/desafios";
import {
  DIFICULDADES_DESAFIO,
  PERIODOS_DESAFIO,
  type DesafioDificuldade,
  type DesafioOrigem,
  type DesafioPeriodo,
} from "@/lib/data/desafios-constantes";
import { METRICAS, type MetaMetrica } from "@/lib/data/metas-quantitativas-constantes";
import type { DesafioMetaView } from "@/lib/data/desafios";
import type { VariavelView } from "@/lib/data/variaveis";

export function DesafioMetaSheet({
  open,
  onOpenChange,
  desafioId,
  tipo,
  metaPaiId,
  editando,
  precisaAprovacao,
  templatesChecklist,
  variaveis,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  desafioId: string;
  tipo: "grande" | "pequena";
  metaPaiId?: string;
  /** Quando presente, o sheet edita a meta em vez de criar uma nova. */
  editando?: DesafioMetaView;
  /** Desafio com mais de um membro: a mudança vira pedido, não vale na hora. */
  precisaAprovacao: boolean;
  templatesChecklist: { id: string; nome: string }[];
  variaveis: VariavelView[];
}) {
  const [pending, executar] = useAcao();
  const [titulo, setTitulo] = useState(editando?.titulo ?? "");
  const [origem, setOrigem] = useState<DesafioOrigem>(editando?.origem ?? "metrica");
  const [metrica, setMetrica] = useState<MetaMetrica>(editando?.metrica ?? "treinos");
  const [rotinaTemplateId, setRotinaTemplateId] = useState<string>(
    editando?.rotinaTemplateId ?? ""
  );
  const [variavelId, setVariavelId] = useState<string>(editando?.variavelId ?? "");
  const [alvo, setAlvo] = useState(editando?.alvo ?? 0);
  const [periodo, setPeriodo] = useState<DesafioPeriodo>(
    editando?.periodo ?? (tipo === "grande" ? "trimestre" : "mes")
  );
  const [dificuldade, setDificuldade] = useState<DesafioDificuldade>(
    editando?.dificuldade ?? "normal"
  );
  const [justificativa, setJustificativa] = useState("");

  const valido =
    titulo.trim().length > 0 &&
    alvo > 0 &&
    (origem === "metrica" ||
      (origem === "checklist" && rotinaTemplateId !== "") ||
      (origem === "variavel" && variavelId !== ""));

  function fechar() {
    onOpenChange(false);
    if (!editando) {
      setTitulo("");
      setAlvo(0);
      setRotinaTemplateId("");
      setVariavelId("");
      setDificuldade("normal");
    }
    setJustificativa("");
  }

  function salvar() {
    const payload: DesafioMetaInput = {
      titulo,
      origem,
      metrica: origem === "metrica" ? metrica : undefined,
      rotinaTemplateId: origem === "checklist" ? rotinaTemplateId : undefined,
      variavelId: origem === "variavel" ? variavelId : undefined,
      alvo,
      periodo,
      dificuldade,
    };

    executar(async () => {
      try {
        const resultado = editando
          ? await editarMeta(editando.id, payload, justificativa)
          : tipo === "grande"
            ? await criarMetaGrande(desafioId, payload, justificativa)
            : metaPaiId
              ? await criarMetaPequena(desafioId, metaPaiId, payload, justificativa)
              : null;

        if (!resultado) return;
        toast.success(
          resultado.aplicado
            ? editando
              ? "Meta atualizada"
              : "Meta criada"
            : "Pedido enviado — a mudança só vale quando todos aprovarem"
        );
        fechar();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao salvar meta");
      }
    });
  }

  const titulos = editando
    ? "Editar meta"
    : tipo === "grande"
      ? "Nova meta grande"
      : "Nova meta menor";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>{titulos}</SheetTitle>

        {precisaAprovacao && (
          <p className="mt-4 rounded-[12px] border border-stroke bg-surface-2 px-3.5 py-3 text-[12.5px] text-mist">
            Este desafio tem mais de um membro: a mudança vira um pedido e só
            entra em vigor quando <span className="text-ice">todos aprovarem</span>.
          </p>
        )}

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
                <SelectItem value="variavel">Variável pessoal</SelectItem>
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

          {origem === "variavel" && (
            <div>
              <Label>Variável</Label>
              {variaveis.length === 0 ? (
                <p className="text-[12px] text-steel">
                  Crie uma variável no checklist (tipo &quot;Variável&quot;) para usar aqui.
                </p>
              ) : (
                <Select value={variavelId} onValueChange={setVariavelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolher variável" />
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

          <div>
            <Label htmlFor="alvo">Alvo</Label>
            <Input
              id="alvo"
              type="number"
              min={0}
              value={alvo || ""}
              onChange={(e) => setAlvo(Number(e.target.value))}
              onFocus={(e) => e.target.select()}
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

          <div>
            <Label>Dificuldade</Label>
            <Segmented
              options={DIFICULDADES_DESAFIO}
              value={dificuldade}
              onChange={setDificuldade}
            />
            <p className="mt-1.5 text-[11.5px] text-steel">
              Metas difíceis rendem 1,5x mais pontos no ranking do desafio.
            </p>
          </div>

          {precisaAprovacao && (
            <div>
              <Label htmlFor="justificativa">Motivo (aparece para o grupo)</Label>
              <Input
                id="justificativa"
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Ex.: mudei de academia e a rotina virou 4x por semana"
              />
            </div>
          )}

          <Button variant="primary" disabled={!valido || pending} onClick={salvar} className="mt-1.5">
            {precisaAprovacao ? "Enviar pedido ao grupo" : "Salvar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
