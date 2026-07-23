"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { editarMeta, type DesafioMetaInput } from "@/app/actions/desafios";

/** Selecionar/trocar o item de checklist vinculado à PRÓPRIA meta. Só aparece nas metas que o viewer possui. */
export function VincularChecklistSelect({
  metaId,
  metaAtual,
  rotinaTemplateIdAtual,
  templatesChecklist,
}: {
  metaId: string;
  metaAtual: DesafioMetaInput;
  rotinaTemplateIdAtual: string | null;
  templatesChecklist: { id: string; nome: string }[];
}) {
  const [pending, startTransition] = useTransition();

  function vincular(templateId: string) {
    startTransition(async () => {
      try {
        await editarMeta(metaId, { ...metaAtual, rotinaTemplateId: templateId });
        toast.success("Checklist vinculado");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao vincular");
      }
    });
  }

  if (templatesChecklist.length === 0) {
    return <p className="text-[11.5px] text-steel">Você não tem itens no checklist para vincular.</p>;
  }

  return (
    <div>
      <p className="mb-1.5 text-[11px] text-steel">Item do checklist vinculado</p>
      <Select disabled={pending} defaultValue={rotinaTemplateIdAtual ?? undefined} onValueChange={vincular}>
        <SelectTrigger>
          <SelectValue placeholder="Escolher item do checklist" />
        </SelectTrigger>
        <SelectContent>
          {templatesChecklist.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
