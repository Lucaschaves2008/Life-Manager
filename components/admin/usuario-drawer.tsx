"use client";

import { useEffect, useState } from "react";
import { useAcao } from "@/lib/acao-cliente";
import { toast } from "sonner";
import { Ban, CheckCircle2, KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  atualizarUsuarioAdmin,
  bloquearUsuario,
  desbloquearUsuario,
  promoverParaAdmin,
  rebaixarParaUsuario,
  resetarSenhaUsuario,
} from "@/app/actions/admin";
import { mediumDate } from "@/lib/dates";
import { initials } from "@/lib/utils";
import type { UsuarioView } from "@/components/admin/usuarios-client";

export function UsuarioDrawer({
  usuario,
  onClose,
}: {
  usuario: UsuarioView | null;
  onClose: () => void;
}) {
  const [pending, executar] = useAcao();
  const [form, setForm] = useState({ nome: "", telefone: "" });
  const [novaSenha, setNovaSenha] = useState<string | null>(null);

  useEffect(() => {
    if (usuario) {
      setForm({ nome: usuario.nome ?? "", telefone: usuario.telefone ?? "" });
      setNovaSenha(null);
    }
  }, [usuario]);

  function run(action: () => Promise<void>, mensagemOk: string) {
    executar(async () => {
      try {
        await action();
        toast.success(mensagemOk);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Algo deu errado.");
      }
    });
  }

  function salvarPerfil() {
    if (!usuario) return;
    run(
      () => atualizarUsuarioAdmin(usuario.id, form),
      "Perfil atualizado."
    );
  }

  function gerarSenha() {
    if (!usuario) return;
    executar(async () => {
      try {
        const senha = await resetarSenhaUsuario(usuario.id);
        setNovaSenha(senha);
        toast.success("Nova senha gerada.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Algo deu errado.");
      }
    });
  }

  return (
    <Sheet open={!!usuario} onOpenChange={(v) => !v && onClose()}>
      <SheetContent>
        {usuario && (
          <>
            <SheetTitle className="sr-only">Detalhe do usuário</SheetTitle>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mint-soft text-[14px] font-medium text-mint">
                {initials(usuario.nome, usuario.email)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-medium text-ice">
                  {usuario.nome || usuario.email}
                </p>
                <p className="truncate text-[12.5px] text-steel">{usuario.email}</p>
              </div>
              <StatusPill
                tone={usuario.status === "ativo" ? "mint" : "coral"}
                className="ml-auto shrink-0"
              >
                {usuario.status === "ativo" ? "Ativo" : "Bloqueado"}
              </StatusPill>
            </div>

            <Tabs defaultValue="perfil" className="mt-6">
              <TabsList>
                <TabsTrigger value="perfil">Perfil</TabsTrigger>
                <TabsTrigger value="acesso">Acesso</TabsTrigger>
                <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
              </TabsList>

              <TabsContent value="perfil" className="space-y-5">
                <div>
                  <Label htmlFor="d-nome">Nome de exibição</Label>
                  <div className="flex gap-2">
                    <Input
                      id="d-nome"
                      value={form.nome}
                      onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={pending}
                      onClick={salvarPerfil}
                    >
                      Salvar
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="d-telefone">Telefone</Label>
                  <Input
                    id="d-telefone"
                    value={form.telefone}
                    onChange={(e) => setForm((s) => ({ ...s, telefone: e.target.value }))}
                  />
                </div>

                <div className="border-t border-stroke pt-5">
                  <Label>Senha</Label>
                  <p className="mb-2 text-[12px] text-steel">
                    Gera uma nova senha aleatória. O usuário precisará trocá-la.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={gerarSenha}
                  >
                    <KeyRound className="h-4 w-4" strokeWidth={1.5} />
                    Gerar nova senha
                  </Button>
                  {novaSenha && (
                    <div className="mt-3 rounded-[12px] border border-stroke bg-surface-2 px-3.5 py-2.5">
                      <p className="text-[11.5px] text-steel">Nova senha (copie agora)</p>
                      <p className="mt-1 font-mono text-[13.5px] text-ice">{novaSenha}</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="acesso" className="space-y-5">
                <div className="flex items-center justify-between rounded-[14px] border border-stroke bg-surface-2 px-4 py-3">
                  <div>
                    <p className="text-[13.5px] text-ice">Papel</p>
                    <p className="text-[12px] text-steel">
                      {usuario.role === "super_admin" ? "Super admin" : "Usuário comum"}
                    </p>
                  </div>
                  {usuario.role === "super_admin" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(() => rebaixarParaUsuario(usuario.id), "Rebaixado para usuário.")
                      }
                    >
                      <ShieldOff className="h-4 w-4" strokeWidth={1.5} />
                      Rebaixar
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(() => promoverParaAdmin(usuario.id), "Promovido a super admin.")
                      }
                    >
                      <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />
                      Promover
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-[14px] border border-stroke bg-surface-2 px-4 py-3">
                  <div>
                    <p className="text-[13.5px] text-ice">Status da conta</p>
                    <p className="text-[12px] text-steel">
                      {usuario.status === "ativo" ? "Pode acessar o app." : "Acesso bloqueado."}
                    </p>
                  </div>
                  {usuario.status === "ativo" ? (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(() => bloquearUsuario(usuario.id), "Usuário bloqueado.")
                      }
                    >
                      <Ban className="h-4 w-4" strokeWidth={1.5} />
                      Bloquear
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(() => desbloquearUsuario(usuario.id), "Usuário desbloqueado.")
                      }
                    >
                      <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                      Desbloquear
                    </Button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="auditoria" className="space-y-3">
                <div className="rounded-[14px] border border-stroke bg-surface-2 px-4 py-3">
                  <p className="text-[11.5px] text-steel">Criado em</p>
                  <p className="mt-1 text-[13.5px] text-ice">{mediumDate(usuario.criadoEm)}</p>
                </div>
                <div className="rounded-[14px] border border-stroke bg-surface-2 px-4 py-3">
                  <p className="text-[11.5px] text-steel">ID</p>
                  <p className="mt-1 font-mono text-[12px] text-ice">{usuario.id}</p>
                </div>
                <p className="text-[12px] text-steel">
                  Histórico detalhado de ações ainda não está disponível.
                </p>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
