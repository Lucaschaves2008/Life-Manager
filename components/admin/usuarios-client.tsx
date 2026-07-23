"use client";

import { useState, useTransition } from "react";
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
  convidarUsuario,
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
  const [pending, startTransition] = useTransition();
  const [sheetAberto, setSheetAberto] = useState(false);
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [selecionado, setSelecionado] = useState<UsuarioView | null>(null);

  const usuarioAtual = usuarios.find((u) => u.id === selecionado?.id) ?? null;

  function run(action: () => Promise<void>, mensagemOk: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(mensagemOk);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Algo deu errado.");
      }
    });
  }

  function convidar() {
    if (!email.trim()) return;
    startTransition(async () => {
      try {
        await convidarUsuario(email.trim(), nome.trim() || undefined);
        toast.success(`Convite enviado para ${email}.`);
        setSheetAberto(false);
        setEmail("");
        setNome("");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Algo deu errado.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setSheetAberto(true)}>
          <Plus className="h-4 w-4" strokeWidth={2} />
          Convidar usuário
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
              <Td>
                <div className="font-medium text-ice">{u.nome || u.email}</div>
                {u.nome && <div className="text-[12px] text-steel">{u.email}</div>}
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

      <Sheet open={sheetAberto} onOpenChange={setSheetAberto}>
        <SheetContent>
          <SheetTitle>Convidar usuário</SheetTitle>
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
            <Button
              variant="primary"
              className="w-full"
              disabled={pending || !email.trim()}
              onClick={convidar}
            >
              Enviar convite
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <UsuarioDrawer usuario={usuarioAtual} onClose={() => setSelecionado(null)} />
    </div>
  );
}
