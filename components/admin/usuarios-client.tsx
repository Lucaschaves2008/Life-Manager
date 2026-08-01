"use client";

import { useState } from "react";
import { useAcao } from "@/lib/acao-cliente";
import { Ban, CheckCircle2, Plus, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { StatusPill, Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { DotsMenu } from "@/components/caverna/dots-menu";
import { UsuarioDrawer } from "@/components/admin/usuario-drawer";
import {
  bloquearUsuario,
  criarUsuario,
  desbloquearUsuario,
  excluirUsuario,
  promoverParaAdmin,
  rebaixarParaUsuario,
} from "@/app/actions/admin";

export type UsuarioView = {
  id: string;
  email: string;
  nome: string | null;
  telefone: string | null;
  role: string;
  status: string;
  criadoEm: Date;
};

export function UsuariosClient({ usuarios }: { usuarios: UsuarioView[] }) {
  const [pending, executar] = useAcao();
  const [sheetAberto, setSheetAberto] = useState(false);
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [senhaCustom, setSenhaCustom] = useState("");
  const [mostrarSenhaCustom, setMostrarSenhaCustom] = useState(false);
  const [senhaGerada, setSenhaGerada] = useState<{ email: string; senha: string } | null>(null);
  const [selecionado, setSelecionado] = useState<UsuarioView | null>(null);

  const usuarioAtual = usuarios.find((u) => u.id === selecionado?.id) ?? null;

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

  function criar() {
    if (!email.trim()) return;
    executar(async () => {
      try {
        const senha = await criarUsuario(
          email.trim(),
          nome.trim() || undefined,
          senhaCustom.trim() || undefined
        );
        setSenhaGerada({ email: email.trim(), senha });
        toast.success(`Usuário ${email} criado.`);
        setEmail("");
        setNome("");
        setSenhaCustom("");
        setMostrarSenhaCustom(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Algo deu errado.");
      }
    });
  }

  function fecharSheet(aberto: boolean) {
    setSheetAberto(aberto);
    if (!aberto) {
      setSenhaGerada(null);
      setEmail("");
      setNome("");
      setSenhaCustom("");
      setMostrarSenhaCustom(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setSheetAberto(true)}>
          <Plus className="h-4 w-4" strokeWidth={2} />
          Adicionar usuário
        </Button>
      </div>

      <Table>
        <THead>
          <Th>Usuário</Th>
          <Th>Papel</Th>
          <Th>Status</Th>
          <Th right>Ações</Th>
        </THead>
        <tbody>
          {usuarios.map((u) => (
            <Tr
              key={u.id}
              className="cursor-pointer"
              onClick={() => setSelecionado(u)}
            >
              <Td className="max-w-[160px] whitespace-normal">
                <div className="truncate font-medium text-ice">{u.nome || u.email}</div>
                {u.nome && <div className="truncate text-[12px] text-steel">{u.email}</div>}
              </Td>
              <Td>
                <StatusPill tone={u.role === "super_admin" ? "mint" : "steel"}>
                  {u.role === "super_admin" ? "Super admin" : "Usuário"}
                </StatusPill>
              </Td>
              <Td>
                <StatusPill tone={u.status === "ativo" ? "mint" : "coral"}>
                  {u.status === "ativo" ? "Ativo" : "Bloqueado"}
                </StatusPill>
              </Td>
              <Td right onClick={(e) => e.stopPropagation()}>
                <DotsMenu
                  items={[
                    u.status === "ativo"
                      ? {
                          label: "Bloquear",
                          icon: Ban,
                          destructive: true,
                          onSelect: () =>
                            run(() => bloquearUsuario(u.id), `${u.email} bloqueado.`),
                        }
                      : {
                          label: "Desbloquear",
                          icon: CheckCircle2,
                          onSelect: () =>
                            run(() => desbloquearUsuario(u.id), `${u.email} desbloqueado.`),
                        },
                    u.role === "super_admin"
                      ? {
                          label: "Rebaixar para usuário",
                          icon: ShieldOff,
                          onSelect: () =>
                            run(() => rebaixarParaUsuario(u.id), `${u.email} agora é usuário comum.`),
                        }
                      : {
                          label: "Promover a admin",
                          icon: ShieldCheck,
                          onSelect: () =>
                            run(() => promoverParaAdmin(u.id), `${u.email} agora é super admin.`),
                        },
                    {
                      label: "Excluir",
                      icon: Trash2,
                      destructive: true,
                      onSelect: () =>
                        run(() => excluirUsuario(u.id), `${u.email} excluído.`),
                    },
                  ]}
                />
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>

      <Sheet open={sheetAberto} onOpenChange={fecharSheet}>
        <SheetContent>
          <SheetTitle>Adicionar usuário</SheetTitle>

          {senhaGerada ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-[12px] border border-stroke bg-surface-2 px-3.5 py-3">
                <p className="text-[12px] text-steel">Usuário criado</p>
                <p className="mt-1 text-[13.5px] text-ice">{senhaGerada.email}</p>
                <p className="mt-3 text-[12px] text-steel">Senha (copie e envie manualmente)</p>
                <p className="mt-1 font-mono text-[15px] text-ice">{senhaGerada.senha}</p>
              </div>
              <p className="text-[12px] text-steel">
                Nenhum email foi enviado. Repasse email e senha diretamente ao usuário.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSenhaGerada(null)}
              >
                Adicionar outro usuário
              </Button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div>
                <Label htmlFor="nome">Nome (opcional)</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pessoa@exemplo.com"
                />
              </div>

              {mostrarSenhaCustom ? (
                <div>
                  <Label htmlFor="senha">Senha</Label>
                  <Input
                    id="senha"
                    type="text"
                    value={senhaCustom}
                    onChange={(e) => setSenhaCustom(e.target.value)}
                    placeholder="Defina a senha do usuário"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className="text-[12.5px] text-steel underline underline-offset-2 hover:text-ice"
                  onClick={() => setMostrarSenhaCustom(true)}
                >
                  Definir uma senha específica (opcional)
                </button>
              )}

              <Button
                variant="primary"
                className="w-full"
                disabled={pending || !email.trim()}
                onClick={criar}
              >
                Criar usuário
              </Button>
              <p className="text-[12px] text-steel">
                Nenhum email é enviado. A senha ficará disponível aqui para você copiar e enviar
                manualmente (WhatsApp, etc).
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <UsuarioDrawer usuario={usuarioAtual} onClose={() => setSelecionado(null)} />
    </div>
  );
}
