"use client";

import { useState, useTransition } from "react";
import { PartyPopper, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Card, CardLabel } from "@/components/caverna/card";
import {
  excluirDiaRegistro,
  reiniciarDiaChecklist,
  salvarDiaRegistro,
} from "@/app/actions/rotinas";

/**
 * Card que aparece quando o checklist do dia chega a 100% — convida o usuário
 * a escrever como foi o dia. Também expõe "Reiniciar dia" (desmarca tudo,
 * moldes recorrentes continuam intactos) sempre que há algo feito no dia.
 */
export function DiaRegistroCard({
  dia,
  pct,
  temItens,
  registroExistente,
}: {
  dia: string;
  pct: number;
  temItens: boolean;
  registroExistente: string | null;
}) {
  const [descricao, setDescricao] = useState(registroExistente ?? "");
  const [pending, startSalvar] = useTransition();
  const [, startReiniciar] = useTransition();
  const [confirmarReiniciar, setConfirmarReiniciar] = useState(false);

  const completo = pct >= 100;
  if (!completo && !registroExistente) return null;

  return (
    <Card destaque={completo} className="col-span-12">
      <div className="flex items-center gap-2.5">
        <PartyPopper className="h-5 w-5 text-mint" strokeWidth={1.5} />
        <CardLabel>
          {completo ? "Dia concluído — como foi?" : "Registro do dia"}
        </CardLabel>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <Textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Escreva como foi seu dia, o que funcionou, o que quer ajustar amanhã…"
          rows={3}
        />
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            disabled={!descricao.trim() || pending}
            onClick={() =>
              startSalvar(async () => {
                await salvarDiaRegistro(dia, descricao, pct);
                toast.success("Registro do dia salvo");
              })
            }
          >
            {pending ? "Salvando…" : "Salvar registro"}
          </Button>

          {temItens && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!confirmarReiniciar) {
                  setConfirmarReiniciar(true);
                  return;
                }
                startReiniciar(async () => {
                  await reiniciarDiaChecklist(dia);
                  await excluirDiaRegistro(dia);
                  setDescricao("");
                  setConfirmarReiniciar(false);
                  toast.success("Dia reiniciado");
                });
              }}
              className="ml-auto text-steel hover:text-coral"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
              {confirmarReiniciar ? "Confirmar reinício?" : "Reiniciar dia"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
