"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, Copy, MapPin, Pencil, Repeat, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  addEventNote,
  deleteEvent,
  deleteEventNote,
  duplicateEvent,
  getEventNotes,
  restoreEvent,
} from "@/app/actions/agenda";
import { describeRrule } from "@/lib/recurrence";
import type { OcorrenciaView } from "@/lib/data/agenda";
import { cn } from "@/lib/utils";

type Nota = { id: string; texto: string; criadoEm: string };

const rotuloLembrete = (min: number | null): string | null => {
  if (min == null) return null;
  if (min === 0) return "Na hora";
  if (min < 60) return `${min} minutos antes`;
  if (min === 60) return "1 hora antes";
  if (min === 1440) return "1 dia antes";
  return `${Math.round(min / 60)} horas antes`;
};

export function EventoDetalhe({
  ocorrencia,
  onOpenChange,
  onEditar,
  formatarPeriodo,
  formatarNota,
}: {
  ocorrencia: OcorrenciaView | null;
  onOpenChange: (v: boolean) => void;
  onEditar: (oc: OcorrenciaView) => void;
  formatarPeriodo: (oc: OcorrenciaView) => string;
  formatarNota: (iso: string) => string;
}) {
  const [, startTransition] = useTransition();
  const [notas, setNotas] = useState<Nota[]>([]);
  const [rascunho, setRascunho] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  const eventId = ocorrencia?.eventId ?? null;
  const readonly = ocorrencia?.readonly ?? false;

  useEffect(() => {
    if (!eventId || readonly) {
      setNotas([]);
      return;
    }
    let ativo = true;
    getEventNotes(eventId).then((n) => ativo && setNotas(n));
    return () => {
      ativo = false;
    };
  }, [eventId, readonly]);

  if (!ocorrencia) return null;

  const recorrencia = describeRrule(ocorrencia.rrule);

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
    <Dialog open={!!ocorrencia} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[86vh] w-[min(480px,94vw)] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className="mt-1.5 h-3 w-3 shrink-0 rounded-[4px]"
              style={{ background: ocorrencia.cor }}
            />
            <div>
              <DialogTitle>{ocorrencia.titulo}</DialogTitle>
              <p className="mt-1 text-[13px] text-mist">
                {formatarPeriodo(ocorrencia)}
              </p>
            </div>
          </div>

          {!readonly && (
            <div className="flex items-center gap-0.5">
              <button
                aria-label="Editar evento"
                onClick={() => onEditar(ocorrencia)}
                className="rounded-full p-1.5 text-steel transition-colors hover:bg-surface-2 hover:text-ice"
              >
                <Pencil className="h-4 w-4" strokeWidth={1.5} />
              </button>
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
                aria-label="Fechar"
                onClick={() => onOpenChange(false)}
                className="rounded-full p-1.5 text-steel transition-colors hover:bg-surface-2 hover:text-ice"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-3 text-[13px] text-mist">
          {recorrencia && (
            <p className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-steel" strokeWidth={1.5} />
              {recorrencia}
            </p>
          )}
          {ocorrencia.local && (
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-steel" strokeWidth={1.5} />
              {ocorrencia.local}
            </p>
          )}
          {rotuloLembrete(ocorrencia.lembreteMin) && (
            <p className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-steel" strokeWidth={1.5} />
              {rotuloLembrete(ocorrencia.lembreteMin)}
            </p>
          )}
          {ocorrencia.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ocorrencia.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11.5px] text-mist"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {ocorrencia.descricao && (
            <p className="whitespace-pre-line text-ice">{ocorrencia.descricao}</p>
          )}
          <p className="text-[12px] text-steel">Agenda: {ocorrencia.calendarNome}</p>
        </div>

        {confirmando && (
          <div className="mt-5 rounded-[14px] border border-stroke bg-surface-2 p-4">
            <p className="text-[13px] text-ice">Excluir evento recorrente</p>
            <div className="mt-3 flex flex-wrap gap-2">
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

        {!readonly && (
          <div className="mt-6">
            <p className="microlabel">Notas</p>
            <div className="mt-2 flex flex-col">
              {notas.length === 0 && (
                <p className="py-2 text-[12.5px] text-steel">
                  Nenhuma nota neste evento.
                </p>
              )}
              {notas.map((nota) => (
                <div
                  key={nota.id}
                  className={cn(
                    "group flex items-start gap-3 border-b border-stroke py-2.5 last:border-0"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-ice">{nota.texto}</p>
                    <p className="tabular text-[11px] text-steel">
                      {formatarNota(nota.criadoEm)}
                    </p>
                  </div>
                  <button
                    aria-label="Excluir nota"
                    onClick={() =>
                      startTransition(async () => {
                        await deleteEventNote(nota.id);
                        setNotas((atual) => atual.filter((n) => n.id !== nota.id));
                      })
                    }
                    className="rounded-md p-1 text-steel opacity-0 transition-opacity hover:text-coral group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>

            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const texto = rascunho.trim();
                if (!texto || !eventId) return;
                setRascunho("");
                startTransition(async () => {
                  await addEventNote(eventId, texto);
                  setNotas(await getEventNotes(eventId));
                });
              }}
            >
              <Input
                value={rascunho}
                onChange={(e) => setRascunho(e.target.value)}
                placeholder="Adicionar nota…"
              />
              <Button variant="soft" size="sm" type="submit" disabled={!rascunho.trim()}>
                Salvar
              </Button>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
