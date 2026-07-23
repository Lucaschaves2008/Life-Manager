"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { changePassword } from "@/app/actions/settings";

export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setAtual("");
    setNova("");
    setConfirmar("");
  }

  function salvar() {
    if (nova !== confirmar) {
      toast.error("As senhas não coincidem.");
      return;
    }
    startTransition(async () => {
      try {
        await changePassword(atual, nova);
        toast.success("Senha alterada.");
        setOpen(false);
        reset();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível trocar a senha.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-center">
          Alterar senha
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Alterar senha</DialogTitle>
        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="senha-atual">Senha atual</Label>
            <Input
              id="senha-atual"
              type="password"
              value={atual}
              onChange={(e) => setAtual(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div>
            <Label htmlFor="senha-nova">Nova senha</Label>
            <Input
              id="senha-nova"
              type="password"
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div>
            <Label htmlFor="senha-confirmar">Confirmar nova senha</Label>
            <Input
              id="senha-confirmar"
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button
            type="button"
            variant="primary"
            className="w-full"
            disabled={pending || !atual || !nova || !confirmar}
            onClick={salvar}
          >
            {pending ? "Salvando…" : "Salvar nova senha"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
