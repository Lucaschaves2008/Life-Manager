"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * Exclusão de conta — UI completa com confirmação forte, DESARMADA de
 * propósito.
 *
 * Não existe server action de exclusão neste código: o botão final não chama
 * nada. É intencional, a pedido do dono da conta. Para armar de verdade seria
 * preciso, num passo separado e revisado: apagar as linhas do usuário (cascata
 * a partir de ContaFinanceira + tabelas com userId solto), remover o usuário do
 * Supabase Auth e derrubar a sessão.
 */
export function ExcluirConta({ email }: { email: string }) {
  const [aberto, setAberto] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");

  const confere = confirmacao.trim().toLowerCase() === email.trim().toLowerCase();

  return (
    <>
      <div className="flex flex-col gap-3 rounded-[14px] border border-[rgba(255,107,107,.25)] bg-coral-soft px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral" strokeWidth={1.5} />
          <div className="min-w-0">
            <p className="text-[13.5px] text-ice">Excluir minha conta</p>
            <p className="text-[12px] leading-relaxed text-steel">
              Apaga o perfil e todos os registros de finanças, treinos, dieta e
              estudos. Não dá para desfazer.
            </p>
          </div>
        </div>
        <Button
          variant="danger"
          size="sm"
          className="shrink-0"
          onClick={() => {
            setConfirmacao("");
            setAberto(true);
          }}
        >
          Excluir conta
        </Button>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent aria-describedby={undefined} className="w-[min(460px,94vw)]">
          <DialogTitle>Excluir sua conta</DialogTitle>

          <div className="mt-4 flex flex-col gap-4">
            <p className="text-[13px] leading-relaxed text-mist">
              Isso removeria de forma permanente seu perfil e todo o histórico
              do MYLIFE. Exporte seus dados antes, se ainda não fez.
            </p>

            <div className="rounded-[10px] border border-[rgba(245,177,76,.3)] bg-amber-soft px-3.5 py-2.5">
              <p className="text-[12px] leading-relaxed text-amber">
                A exclusão está desativada nesta versão — o botão abaixo não
                apaga nada. Fale comigo antes de ativar.
              </p>
            </div>

            <div>
              <Label htmlFor="confirmar-email">
                Digite <span className="text-ice">{email}</span> para confirmar
              </Label>
              <Input
                id="confirmar-email"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                placeholder={email}
                autoComplete="off"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button variant="danger" size="sm" disabled={!confere} title="Desativado nesta versão">
                Excluir permanentemente
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
