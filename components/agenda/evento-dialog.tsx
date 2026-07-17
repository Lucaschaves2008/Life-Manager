"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagsInput } from "@/components/caverna/tags-input";
import { createEvent, updateEvent, type EventoInput } from "@/app/actions/agenda";
import type { Rrule } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

export type CalendarioView = {
  id: string;
  nome: string;
  cor: string;
  visivel: boolean;
  readonly: boolean;
};

export type EventoEdicao = {
  eventId: string;
  dayKey: string;
  titulo: string;
  dia: string;
  horaInicio: string;
  horaFim: string;
  diaInteiro: boolean;
  calendarId: string;
  rrule: string | null;
  local: string | null;
  descricao: string | null;
  tags: string[];
  lembreteMin: number | null;
  recorrente: boolean;
};

const diasSemana = ["D", "S", "T", "Q", "Q", "S", "S"];

const lembretes = [
  { value: "nenhum", label: "Sem lembrete" },
  { value: "0", label: "Na hora" },
  { value: "10", label: "10 minutos antes" },
  { value: "30", label: "30 minutos antes" },
  { value: "60", label: "1 hora antes" },
  { value: "1440", label: "1 dia antes" },
];

type FreqUI = "nunca" | "daily" | "weekly" | "monthly" | "yearly";

function freqDoRrule(raw: string | null): FreqUI {
  if (!raw) return "nunca";
  try {
    return (JSON.parse(raw) as Rrule).freq ?? "nunca";
  } catch {
    return "nunca";
  }
}

function bydayDoRrule(raw: string | null): number[] {
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as Rrule).byday ?? [];
  } catch {
    return [];
  }
}

export function EventoDialog({
  aberto,
  onOpenChange,
  calendarios,
  inicial,
  editando,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  calendarios: CalendarioView[];
  /** valores pré-preenchidos ao criar (clique num slot) */
  inicial?: { dia: string; horaInicio: string; horaFim: string; diaInteiro?: boolean };
  editando?: EventoEdicao | null;
}) {
  const [pending, startSalvar] = useTransition();

  const [titulo, setTitulo] = useState(editando?.titulo ?? "");
  const [dia, setDia] = useState(editando?.dia ?? inicial?.dia ?? "");
  const [horaInicio, setHoraInicio] = useState(
    editando?.horaInicio ?? inicial?.horaInicio ?? "09:00"
  );
  const [horaFim, setHoraFim] = useState(editando?.horaFim ?? inicial?.horaFim ?? "10:00");
  const [diaInteiro, setDiaInteiro] = useState(
    editando?.diaInteiro ?? inicial?.diaInteiro ?? false
  );
  const [calendarId, setCalendarId] = useState(
    editando?.calendarId ?? calendarios.find((c) => !c.readonly)?.id ?? ""
  );
  const [freq, setFreq] = useState<FreqUI>(freqDoRrule(editando?.rrule ?? null));
  const [byday, setByday] = useState<number[]>(bydayDoRrule(editando?.rrule ?? null));
  const [lembrete, setLembrete] = useState(
    editando?.lembreteMin != null ? String(editando.lembreteMin) : "nenhum"
  );
  const [local, setLocal] = useState(editando?.local ?? "");
  const [descricao, setDescricao] = useState(editando?.descricao ?? "");
  const [tags, setTags] = useState<string[]>(editando?.tags ?? []);
  const [escopo, setEscopo] = useState<"todos" | "unica" | "seguintes">("unica");

  function montarRrule(): string | null {
    if (freq === "nunca") return null;
    const regra: Rrule =
      freq === "weekly"
        ? {
            freq,
            byday:
              byday.length > 0
                ? byday
                : [new Date(`${dia}T12:00:00-03:00`).getDay()],
          }
        : { freq };
    return JSON.stringify(regra);
  }

  function salvar() {
    const payload: EventoInput = {
      titulo,
      dia,
      horaInicio,
      horaFim,
      diaInteiro,
      calendarId,
      rrule: montarRrule(),
      local,
      descricao,
      tags,
      lembreteMin: lembrete === "nenhum" ? null : Number(lembrete),
    };

    startSalvar(async () => {
      if (editando) {
        await updateEvent(
          editando.eventId,
          payload,
          editando.recorrente ? escopo : "todos",
          editando.dayKey
        );
        toast.success("Evento atualizado");
      } else {
        await createEvent(payload);
        toast.success("Evento criado");
      }
      onOpenChange(false);
    });
  }

  const editaveis = calendarios.filter((c) => !c.readonly);

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[88vh] w-[min(560px,94vw)] overflow-y-auto"
      >
        <DialogTitle>{editando ? "Editar evento" : "Novo evento"}</DialogTitle>

        <div className="mt-5 flex flex-col gap-5">
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Adicionar título"
            className="h-11 text-[16px]"
            autoFocus
          />

          <div>
            <Label>Agenda</Label>
            <Select value={calendarId} onValueChange={setCalendarId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolher agenda" />
              </SelectTrigger>
              <SelectContent>
                {editaveis.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: c.cor }}
                      />
                      {c.nome}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ev-dia">Data</Label>
              <Input
                id="ev-dia"
                type="date"
                value={dia}
                onChange={(e) => setDia(e.target.value)}
                className="tabular"
              />
            </div>
            <div className="flex items-end pb-2.5">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-mist">
                <Checkbox
                  checked={diaInteiro}
                  onCheckedChange={(v) => setDiaInteiro(v === true)}
                />
                Dia inteiro
              </label>
            </div>
          </div>

          {!diaInteiro && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ev-ini">Início</Label>
                <Input
                  id="ev-ini"
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="tabular"
                />
              </div>
              <div>
                <Label htmlFor="ev-fim">Fim</Label>
                <Input
                  id="ev-fim"
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                  className="tabular"
                />
              </div>
            </div>
          )}

          <div>
            <Label>Recorrência</Label>
            <Select value={freq} onValueChange={(v) => setFreq(v as FreqUI)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nunca">Não se repete</SelectItem>
                <SelectItem value="daily">Todos os dias</SelectItem>
                <SelectItem value="weekly">Semanalmente</SelectItem>
                <SelectItem value="monthly">Mensalmente</SelectItem>
                <SelectItem value="yearly">Anualmente</SelectItem>
              </SelectContent>
            </Select>

            {freq === "weekly" && (
              <div className="mt-3 flex gap-1.5">
                {diasSemana.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Dia ${i}`}
                    onClick={() =>
                      setByday((atual) =>
                        atual.includes(i)
                          ? atual.filter((d) => d !== i)
                          : [...atual, i]
                      )
                    }
                    className={cn(
                      "h-8 w-8 rounded-full border text-[12px] transition-colors",
                      byday.includes(i)
                        ? "border-transparent bg-mint text-[var(--color-bg)]"
                        : "border-stroke text-mist hover:border-mint hover:text-mint"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Lembrete</Label>
            <Select value={lembrete} onValueChange={setLembrete}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {lembretes.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="ev-local">Local</Label>
            <Input
              id="ev-local"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Onde vai ser?"
            />
          </div>

          <div>
            <Label htmlFor="ev-desc">Descrição</Label>
            <Textarea
              id="ev-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="min-h-20"
            />
          </div>

          <div>
            <Label>Tags</Label>
            <TagsInput value={tags} onChange={setTags} />
          </div>

          {editando?.recorrente && (
            <div className="rounded-[14px] border border-stroke bg-surface-2 p-4">
              <p className="microlabel">Aplicar alteração a</p>
              <div className="mt-3 flex flex-col gap-2">
                {(
                  [
                    { v: "unica", label: "Este evento" },
                    { v: "seguintes", label: "Este e os seguintes" },
                    { v: "todos", label: "Todos os eventos da série" },
                  ] as const
                ).map((opcao) => (
                  <label
                    key={opcao.v}
                    className="flex cursor-pointer items-center gap-2 text-[13px] text-mist"
                  >
                    <input
                      type="radio"
                      name="escopo"
                      checked={escopo === opcao.v}
                      onChange={() => setEscopo(opcao.v)}
                      className="accent-[var(--color-mint)]"
                    />
                    {opcao.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              onClick={salvar}
              disabled={!titulo.trim() || !dia || !calendarId || pending}
            >
              {pending ? "Salvando…" : "Salvar"}
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
