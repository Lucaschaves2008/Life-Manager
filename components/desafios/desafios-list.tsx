"use client";

import { useState } from "react";
import { useAcao } from "@/lib/acao-cliente";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn, Plus, Swords, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { entrarNoDesafio, criarDesafio } from "@/app/actions/desafios";
import type { DesafioResumo } from "@/lib/data/desafios";

function CriarDesafioDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [pending, executar] = useAcao();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [metasGrandesLimite, setMetasGrandesLimite] = useState(4);

  function salvar() {
    if (!nome.trim()) return;
    executar(async () => {
      try {
        const desafio = await criarDesafio({ nome, descricao, metasGrandesLimite });
        toast.success("Desafio criado");
        onOpenChange(false);
        setNome("");
        setDescricao("");
        router.push(`/desafios/${desafio.id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao criar desafio");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Novo desafio</DialogTitle>
        <div className="mt-6 flex flex-col gap-4">
          <div>
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Bora ficar em forma"
            />
          </div>
          <div>
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Input
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Desafio de treino e alimentação do 2º semestre"
            />
          </div>
          <div>
            <Label htmlFor="limite">Metas grandes por participante</Label>
            <Input
              id="limite"
              type="number"
              min={1}
              max={10}
              value={metasGrandesLimite}
              onChange={(e) => setMetasGrandesLimite(Number(e.target.value))}
            />
            <p className="mt-1.5 text-[11.5px] text-steel">
              Cada participante cadastra as próprias metas — até este limite de metas grandes.
            </p>
          </div>
          <Button variant="primary" disabled={!nome.trim() || pending} onClick={salvar} className="mt-1.5">
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Criar desafio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EntrarDesafioDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [pending, executar] = useAcao();
  const [codigo, setCodigo] = useState("");

  function entrar() {
    if (!codigo.trim()) return;
    executar(async () => {
      try {
        const desafioId = await entrarNoDesafio(codigo);
        toast.success("Você entrou no desafio");
        onOpenChange(false);
        setCodigo("");
        router.push(`/desafios/${desafioId}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao entrar no desafio");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Entrar em um desafio</DialogTitle>
        <div className="mt-6 flex flex-col gap-4">
          <div>
            <Label htmlFor="codigo">Código de convite</Label>
            <Input
              id="codigo"
              autoFocus
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ex.: 7XK2QP"
              maxLength={6}
              className="tabular tracking-[0.15em]"
            />
          </div>
          <Button variant="primary" disabled={!codigo.trim() || pending} onClick={entrar} className="mt-1.5">
            <LogIn className="h-3.5 w-3.5" strokeWidth={1.5} />
            Entrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DesafiosList({ desafios }: { desafios: DesafioResumo[] }) {
  const [criarAberto, setCriarAberto] = useState(false);
  const [entrarAberto, setEntrarAberto] = useState(false);

  return (
    <div className="flex flex-col gap-2.5">
      {desafios.length === 0 && (
        <p className="py-3 text-[13px] text-steel">
          Você ainda não participa de nenhum desafio. Crie um ou entre com um código de convite.
        </p>
      )}

      {desafios.map((d) => (
        <Link
          key={d.id}
          href={`/desafios/${d.id}`}
          className="group flex items-center justify-between gap-3 rounded-[14px] border border-stroke bg-surface px-4 py-3.5 transition-colors hover:border-[rgba(13,110,253,.3)]"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] text-ice">{d.nome}</p>
            {d.descricao && <p className="mt-0.5 truncate text-[11.5px] text-steel">{d.descricao}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-4 text-[12px] text-steel">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" strokeWidth={1.5} />
              {d.totalMembros}
            </span>
            <span className="flex items-center gap-1.5">
              <Swords className="h-3.5 w-3.5" strokeWidth={1.5} />
              {d.metasGrandesLimite} metas
            </span>
          </div>
        </Link>
      ))}

      <div className="mt-1.5 flex gap-2.5">
        <Button variant="dashed" size="sm" onClick={() => setCriarAberto(true)} className="flex-1">
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          Novo desafio
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEntrarAberto(true)}
          className="flex-1 whitespace-nowrap text-[13px]"
        >
          <LogIn className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
          Entrar com código
        </Button>
      </div>

      <CriarDesafioDialog open={criarAberto} onOpenChange={setCriarAberto} />
      <EntrarDesafioDialog open={entrarAberto} onOpenChange={setEntrarAberto} />
    </div>
  );
}
