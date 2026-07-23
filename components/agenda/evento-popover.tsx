"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, Copy, MapPin, Pencil, Repeat, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { deleteEvent, duplicateEvent, restoreEvent } from "@/app/actions/agenda";
import { describeRrule } from "@/lib/recurrence";
import type { OcorrenciaView } from "@/lib/data/agenda";

const rotuloLembrete = (min: number | null): string | null => {
  if (min == null) return null;
  if (min === 0) return "Na hora";
  if (min < 60) return `${min} minutos antes`;
  if (min === 60) return "1 hora antes";
  if (min === 1440) return "1 dia antes";
  return `${Math.round(min / 60)} horas antes`;
};

export function EventoPopover({
  ocorrencia,
  side = "right",
  onOpenChange,
  onEditar,
  onVerMais,
  formatarPeriodo,
  children,
}: {
  ocorrencia: OcorrenciaView | null;
  side?: "top" | "right" | "bottom" | "left";
  onOpenChange: (v: boolean) => void;
  onEditar: (oc: OcorrenciaView) => void;
  onVerMais?: (oc: OcorrenciaView) => void;
  formatarPeriodo: (oc: OcorrenciaView) => string;
  children: React.ReactNode;
}) {
  const [, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const aberto = !!ocorrencia;
  const readonly = ocorrencia?.readonly ?? false;
  const recorrencia = ocorrencia ? describeRrule(ocorrencia.rrule) : null;

  useEffect(() => {
    if (!aberto) setConfirmando(false);
  }, [aberto]);

  function excluir(modo: "todos" | "unica" | "seguintes") {
    const oc = ocorrencia!;
    startTransition(async () => {
      const removido = await deleteEvent(oc.eventId, modo, oc.dayKey);
      toast("Evento excluído", {
        action: removido
          ? {
              label: "Desfazer",
              onClick: () =>
                restoreEvent({
                  titulo: removido.titulo,
                  inicio: removido.inicio,
                  fim: removido.fim,
                  diaInteiro: removido.diaInteiro,
                  rrule: removido.rrule,
                  exdates: removido.exdates,
                  local: removido.local,
                  descricao: removido.descricao,
                  tags: removido.tags,
                  lembreteMin: removido.lembreteMin,
                  calendarId: removido.calendarId,
                }),
            }
          : undefined,
      });
      setConfirmando(false);
      onOpenChange(false);
    });
  }

  return (
    <Popover open={aberto} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      {aberto && (
        <PopoverContent
          side={side}
          align="start"
          collisionPadding={12}
          className="w-[320px] p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-start justify-between gap-2 px-4 pb-2 pt-4">
            <div className="flex items-start gap-2.5">
              <span
                className="mt-1.5 h-3 w-3 shrink-0 rounded-[4px]"
                style={{ background: ocorrencia.cor }}
              />
              <div className="min-w-0">
                <p className="text-[14.5px] font-medium leading-snug text-paper">
                  {ocorrencia.titulo}
                </p>
                <p className="mt-0.5 text-[12.5px] text-mist">
                  {formatarPeriodo(ocorrencia)}
                </p>
              </div>
            </div>
            <button
              aria-label="Fechar"
              onClick={() => onOpenChange(false)}
              className="rounded-full p-1 text-steel transition-colors hover:bg-surface-2 hover:text-ice"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>

          {(recorrencia || ocorrencia.local || rotuloLembrete(ocorrencia.lembreteMin)) && (
            <div className="flex flex-col gap-1.5 px-4 pb-3 text-[12.5px] text-mist">
              {recorrencia && (
                <p className="flex items-center gap-2">
                  <Repeat className="h-3.5 w-3.5 shrink-0 text-steel" strokeWidth={1.5} />
                  {recorrencia}
                </p>
              )}
              {ocorrencia.local && (
                <p className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-steel" strokeWidth={1.5} />
                  <span className="truncate">{ocorrencia.local}</span>
                </p>
              )}
              {rotuloLembrete(ocorrencia.lembreteMin) && (
                <p className="flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5 shrink-0 text-steel" strokeWidth={1.5} />
                  {rotuloLembrete(ocorrencia.lembreteMin)}
                </p>
              )}
            </div>
          )}

          <p className="px-4 pb-3 text-[11.5px] text-steel">
            Agenda: {ocorrencia.calendarNome}
          </p>

          <div className="flex items-center justify-between gap-2 border-t border-stroke px-3 py-2">
            {onVerMais && (
              <button
                onClick={() => onVerMais(ocorrencia)}
                className="rounded-md px-2 py-1 text-[12px] text-mist transition-colors hover:bg-surface-2 hover:text-ice"
              >
                Mais detalhes
              </button>
            )}
            {!readonly && (
              <div className="ml-auto flex items-center gap-0.5">
                <button
                  aria-label="Duplicar evento"
                  onClick={() =>
                    startTransition(async () => {
                      await duplicateEvent(ocorrencia.eventId);
                      toast.success("Evento duplicado");
                      onOpenChange(false);
                    })
                  }
                  className="rounded-full p-1.5 text-steel transition-colors hover:bg-surface-2 hover:text-ice"
                >
                  <Copy className="h-4 w-4" strokeWidth={1.5} />
                </button>
                <button
                  aria-label="Excluir evento"
                  onClick={() =>
                    ocorrencia.recorrente ? setConfirmando(true) : excluir("todos")
                  }
                  className="rounded-full p-1.5 text-steel transition-colors hover:bg-surface-2 hover:text-coral"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                </button>
                <button
                  aria-label="Editar evento"
                  onClick={() => onEditar(ocorrencia)}
                  className="rounded-full p-1.5 text-steel transition-colors hover:bg-surface-2 hover:text-ice"
                >
                  <Pencil className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            )}
          </div>

          {confirmando && (
            <div className="border-t border-stroke bg-surface-2 p-3">
              <p className="text-[12.5px] text-ice">Excluir evento recorrente</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Button variant="danger" size="sm" onClick={() => excluir("unica")}>
                  Este evento
                </Button>
                <Button variant="outline" size="sm" onClick={() => excluir("seguintes")}>
                  Este e os seguintes
                </Button>
                <Button variant="outline" size="sm" onClick={() => excluir("todos")}>
                  Todos
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmando(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      )}
    </Popover>
  );
}
