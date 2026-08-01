"use client";

import { useState } from "react";
import { useAcao } from "@/lib/acao-cliente";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ChangePasswordDialog } from "@/components/shell/change-password-dialog";
import { updateProfile } from "@/app/actions/settings";

export function ProfileInfoForm({
  nome,
  telefone,
  email,
}: {
  nome: string | null;
  telefone: string | null;
  email: string;
}) {
  const [form, setForm] = useState({ nome: nome ?? "", telefone: telefone ?? "" });
  const [pending, executar] = useAcao();
  const sujo = form.nome !== (nome ?? "") || form.telefone !== (telefone ?? "");

  function salvar() {
    executar(async () => {
      try {
        await updateProfile(form);
        toast.success("Perfil atualizado.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="nome">Nome</Label>
          <Input
            id="nome"
            value={form.nome}
            onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            value={form.telefone}
            onChange={(e) => setForm((s) => ({ ...s, telefone: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" value={email} disabled />
      </div>

      <div>
        <Label>Senha</Label>
        <ChangePasswordDialog />
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={!sujo || pending}
          onClick={salvar}
        >
          {pending ? "Salvando…" : "Salvar"}
        </Button>
        {sujo && !pending && (
          <span className="text-[12.5px] text-steel">Alterações não salvas</span>
        )}
      </div>
    </div>
  );
}
