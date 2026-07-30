"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { transferirEntreContas, listarRecursosParaTransferencia } from "@/app/actions/financas";
import { useCallback } from "react";

interface Recurso {
  id: string;
  nome: string;
  tipo: "conta" | "cartao" | "ativo";
  bandeira?: string;
  classe?: string;
}

interface TransferenciaEntreContasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contaAtiva: { id: string; nome: string };
  outrasContas: { id: string; nome: string }[];
}

export function TransferenciaEntreContasModal({
  open,
  onOpenChange,
  contaAtiva,
  outrasContas,
}: TransferenciaEntreContasProps) {
  const [recursoTipo, setRecursoTipo] = useState<"conta" | "cartao" | "ativo">("conta");
  const [recursoId, setRecursoId] = useState<string>("");
  const [contaDestino, setContaDestino] = useState<string>("");
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregarRecursos = useCallback(async () => {
    if (!contaAtiva.id) return;
    setCarregando(true);
    try {
      const resultado = await listarRecursosParaTransferencia(contaAtiva.id);
      const tipoMap = { contas: "conta", cartoes: "cartao", ativos: "ativo" } as const;
      const todos: Recurso[] = [];
      for (const [key, items] of Object.entries(resultado)) {
        const tipo = tipoMap[key as keyof typeof tipoMap];
        todos.push(
          ...items.map((item: any) => ({
            ...item,
            tipo,
          }))
        );
      }
      setRecursos(todos);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar recursos");
    } finally {
      setCarregando(false);
    }
  }, [contaAtiva.id]);

  const handleTransferir = async () => {
    if (!recursoId || !contaDestino) {
      setErro("Selecione um recurso e a conta de destino");
      return;
    }

    setEnviando(true);
    setErro(null);
    try {
      await transferirEntreContas({
        tipo: recursoTipo,
        recursoId,
        contaOrigemId: contaAtiva.id,
        contaDestinoId: contaDestino,
      });
      setRecursoId("");
      setContaDestino("");
      setRecursoTipo("conta");
      onOpenChange(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao transferir");
    } finally {
      setEnviando(false);
    }
  };

  const recursoSelecionado = recursos.find((r) => r.id === recursoId);
  const recursosFiltrados = recursos.filter((r) => r.tipo === recursoTipo);

  const mostrarNome = (r: Recurso) => {
    if (r.tipo === "cartao" && r.bandeira) return `${r.nome} (${r.bandeira})`;
    if (r.tipo === "ativo" && r.classe) return `${r.nome} (${r.classe})`;
    return r.nome;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div>
          <DialogTitle>Transferir Recurso</DialogTitle>
          <DialogDescription>
            Mova qualquer conta, cartão ou ativo de {contaAtiva.nome} para outra conta
          </DialogDescription>
        </div>

        <div className="space-y-4">
          {/* Tipo de recurso */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de Recurso</label>
            <Select value={recursoTipo} onValueChange={(v: any) => {
              setRecursoTipo(v);
              setRecursoId("");
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conta">Conta</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Recurso específico */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {recursoTipo === "conta" && "Conta"}
              {recursoTipo === "cartao" && "Cartão"}
              {recursoTipo === "ativo" && "Ativo"}
            </label>
            <Select
              value={recursoId}
              onValueChange={setRecursoId}
              disabled={carregando}
            >
              <SelectTrigger>
                <SelectValue placeholder={carregando ? "Carregando..." : "Selecione"} />
              </SelectTrigger>
              <SelectContent>
                {recursosFiltrados.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {mostrarNome(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conta destino */}
          {outrasContas.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Conta de Destino</label>
              <Select value={contaDestino} onValueChange={setContaDestino}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta destino" />
                </SelectTrigger>
                <SelectContent>
                  {outrasContas.map((conta) => (
                    <SelectItem key={conta.id} value={conta.id}>
                      {conta.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {outrasContas.length === 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              Você precisa criar outra conta financeira para fazer transferências
            </div>
          )}

          {erro && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
              {erro}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={enviando}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleTransferir}
              disabled={
                enviando ||
                !recursoId ||
                !contaDestino ||
                recursosFiltrados.length === 0
              }
            >
              {enviando ? "Transferindo..." : "Transferir"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
