"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TZDate } from "@date-fns/tz";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DotsMenu } from "@/components/caverna/dots-menu";
import { Segmented } from "@/components/caverna/segmented";
import { EventoDetalhe } from "@/components/agenda/evento-detalhe";
import {
  EventoDialog,
  type CalendarioView,
  type EventoEdicao,
} from "@/components/agenda/evento-dialog";
import {
  createCalendar,
  deleteCalendar,
  toggleCalendarVisivel,
  updateCalendar,
} from "@/app/actions/agenda";
import type { OcorrenciaView } from "@/lib/data/agenda";
import { cn } from "@/lib/utils";

type Visao = "dia" | "semana" | "mes";

const TZ = "America/Sao_Paulo";
const HORA_PX = 48;
const paleta = [
  "#0D6EFD",
  "#6B96D6",
  "#F5B14C",
  "#FF6B6B",
  "#4EC9C0",
  "#A78BDB",
  "#4E6A9C",
];

const sp = (d: Date | string) => new TZDate(new Date(d), TZ);
const chaveDia = (d: Date) => format(sp(d), "yyyy-MM-dd");
const hhmm = (d: Date | string) => format(sp(d), "HH:mm");

/** Minutos desde a meia-noite (em SP). */
function minutosDoDia(iso: string): number {
  const d = sp(iso);
  return d.getHours() * 60 + d.getMinutes();
}

type Bloco = { oc: OcorrenciaView; col: number; cols: number };

/** Distribui ocorrências sobrepostas em colunas lado a lado. */
function distribuir(ocs: OcorrenciaView[]): Bloco[] {
  const ordenadas = [...ocs].sort(
    (a, b) => minutosDoDia(a.inicio) - minutosDoDia(b.inicio)
  );
  const blocos: Bloco[] = [];
  let cluster: OcorrenciaView[] = [];
  let fimCluster = -1;

  const fechar = () => {
    cluster.forEach((oc, i) =>
      blocos.push({ oc, col: i, cols: cluster.length })
    );
    cluster = [];
    fimCluster = -1;
  };

  for (const oc of ordenadas) {
    const ini = minutosDoDia(oc.inicio);
    const fim = minutosDoDia(oc.fim);
    if (cluster.length > 0 && ini >= fimCluster) fechar();
    cluster.push(oc);
    fimCluster = Math.max(fimCluster, fim);
  }
  if (cluster.length > 0) fechar();
  return blocos;
}

export function AgendaClient({
  ocorrencias,
  calendarios,
  view,
  dataBase,
  abrirNovo,
}: {
  ocorrencias: OcorrenciaView[];
  calendarios: CalendarioView[];
  view: Visao;
  /** yyyy-MM-dd da data âncora da visão */
  dataBase: string;
  abrirNovo: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState<{
    dia: string;
    horaInicio: string;
    horaFim: string;
    diaInteiro?: boolean;
  } | null>(null);
  const [editando, setEditando] = useState<EventoEdicao | null>(null);
  const [detalhe, setDetalhe] = useState<OcorrenciaView | null>(null);
  const [maisDoDia, setMaisDoDia] = useState<string | null>(null);
  const [agora, setAgora] = useState<number | null>(null);
  const [novaAgenda, setNovaAgenda] = useState({ nome: "", cor: paleta[0] });

  const ancora = useMemo(() => sp(`${dataBase}T12:00:00-03:00`), [dataBase]);

  useEffect(() => {
    if (abrirNovo) setCriando({ dia: dataBase, horaInicio: "09:00", horaFim: "10:00" });
  }, [abrirNovo, dataBase]);

  // linha do horário atual, atualizada a cada minuto
  useEffect(() => {
    const tick = () => {
      const n = new TZDate(new Date(), TZ);
      setAgora(n.getHours() * 60 + n.getMinutes());
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  function navegar(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null) next.delete(k);
      else next.set(k, v);
    }
    next.delete("novo");
    router.push(`/agenda?${next.toString()}`);
  }

  function fecharCriacao(v: boolean) {
    if (v) return;
    setCriando(null);
    if (abrirNovo) {
      const next = new URLSearchParams(params.toString());
      next.delete("novo");
      router.replace(`/agenda?${next.toString()}`);
    }
  }

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return termo
      ? ocorrencias.filter((o) => o.titulo.toLowerCase().includes(termo))
      : ocorrencias;
  }, [ocorrencias, busca]);

  const dias = useMemo(() => {
    if (view === "dia") return [ancora];
    if (view === "semana") {
      const ini = startOfWeek(ancora, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: ini, end: addDays(ini, 6) });
    }
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(ancora), { weekStartsOn: 0 }),
      end: endOfWeek(endOfMonth(ancora), { weekStartsOn: 0 }),
    });
  }, [ancora, view]);

  const titulo =
    view === "dia"
      ? format(ancora, "d 'de' MMMM 'de' yyyy", { locale: ptBR })
      : format(ancora, "MMMM 'de' yyyy", { locale: ptBR });

  function passo(direcao: 1 | -1) {
    const proxima =
      view === "mes"
        ? addMonths(ancora, direcao)
        : addDays(ancora, direcao * (view === "semana" ? 7 : 1));
    navegar({ data: chaveDia(proxima) });
  }

  function abrirEdicao(oc: OcorrenciaView) {
    setDetalhe(null);
    setEditando({
      eventId: oc.eventId,
      dayKey: oc.dayKey,
      titulo: oc.titulo,
      dia: oc.dayKey,
      horaInicio: hhmm(oc.inicio),
      horaFim: hhmm(oc.fim),
      diaInteiro: oc.diaInteiro,
      calendarId: oc.calendarId,
      rrule: oc.rrule,
      local: oc.local,
      descricao: oc.descricao,
      tags: oc.tags,
      lembreteMin: oc.lembreteMin,
      recorrente: oc.recorrente,
    });
  }

  const hojeKey = chaveDia(new TZDate(new Date(), TZ));

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navegar({ data: hojeKey })}
        >
          Hoje
        </Button>
        <div className="flex items-center gap-0.5">
          <button
            aria-label="Anterior"
            onClick={() => passo(-1)}
            className="rounded-full p-2 text-mist transition-colors hover:bg-surface-2 hover:text-ice"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <button
            aria-label="Próximo"
            onClick={() => passo(1)}
            className="rounded-full p-2 text-mist transition-colors hover:bg-surface-2 hover:text-ice"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        <h2 className="display text-[22px] capitalize text-paper">{titulo}</h2>

        <div className="ml-auto flex items-center gap-3">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar na visão…"
            className="w-[190px]"
          />
          <Segmented
            options={[
              { label: "Dia", value: "dia" },
              { label: "Semana", value: "semana" },
              { label: "Mês", value: "mes" },
            ]}
            value={view}
            onChange={(v) => navegar({ view: v })}
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar da agenda */}
        <aside className="col-span-12 flex flex-col gap-5 lg:col-span-3">
          <Button
            variant="primary"
            onClick={() =>
              setCriando({ dia: dataBase, horaInicio: "09:00", horaFim: "10:00" })
            }
            className="w-fit"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Criar
          </Button>

          <MiniCalendario
            ancora={ancora}
            hojeKey={hojeKey}
            onSelecionar={(dia) => navegar({ data: dia })}
          />

          <div>
            <p className="microlabel">Minhas agendas</p>
            <div className="mt-3 flex flex-col gap-1.5">
              {calendarios.map((cal) => (
                <div key={cal.id} className="group flex items-center gap-2.5">
                  <Checkbox
                    checked={cal.visivel}
                    aria-label={cal.nome}
                    onCheckedChange={(v) =>
                      startTransition(
                        () => void toggleCalendarVisivel(cal.id, v === true)
                      )
                    }
                    style={
                      {
                        "--cor-agenda": cal.cor,
                      } as React.CSSProperties
                    }
                  />
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                    style={{ background: cal.cor }}
                  />
                  <span className="flex-1 truncate text-[13px] text-mist">
                    {cal.nome}
                  </span>
                  {!cal.readonly && (
                    <span className="opacity-0 transition-opacity group-hover:opacity-100">
                      <DotsMenu
                        items={[
                          {
                            label: "Renomear",
                            icon: Pencil,
                            onSelect: () => {
                              const nome = window.prompt("Nome da agenda", cal.nome);
                              if (!nome?.trim()) return;
                              startTransition(async () => {
                                await updateCalendar(cal.id, nome.trim(), cal.cor);
                                toast.success("Agenda atualizada");
                              });
                            },
                          },
                          {
                            label: "Excluir",
                            icon: Trash2,
                            destructive: true,
                            onSelect: () =>
                              startTransition(async () => {
                                await deleteCalendar(cal.id);
                                toast.success("Agenda excluída");
                              }),
                          },
                        ]}
                      />
                    </span>
                  )}
                </div>
              ))}
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="dashed" size="sm" className="mt-3 w-full">
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Nova agenda
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px]">
                <p className="microlabel">Nova agenda</p>
                <Input
                  value={novaAgenda.nome}
                  onChange={(e) =>
                    setNovaAgenda({ ...novaAgenda, nome: e.target.value })
                  }
                  placeholder="Nome"
                  className="mt-2.5"
                />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {paleta.map((cor) => (
                    <button
                      key={cor}
                      type="button"
                      aria-label={`Cor ${cor}`}
                      onClick={() => setNovaAgenda({ ...novaAgenda, cor })}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-transform",
                        novaAgenda.cor === cor
                          ? "scale-110 border-paper"
                          : "border-transparent"
                      )}
                      style={{ background: cor }}
                    />
                  ))}
                </div>
                <Button
                  variant="soft"
                  size="sm"
                  className="mt-3 w-full"
                  disabled={!novaAgenda.nome.trim()}
                  onClick={() =>
                    startTransition(async () => {
                      await createCalendar(novaAgenda.nome.trim(), novaAgenda.cor);
                      setNovaAgenda({ nome: "", cor: paleta[0] });
                      toast.success("Agenda criada");
                    })
                  }
                >
                  Criar agenda
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        </aside>

        {/* Grade */}
        <div className="col-span-12 overflow-hidden rounded-[20px] border border-stroke bg-surface lg:col-span-9">
          {view === "mes" ? (
            <VisaoMes
              dias={dias}
              ancora={ancora}
              hojeKey={hojeKey}
              ocorrencias={filtradas}
              maisDoDia={maisDoDia}
              setMaisDoDia={setMaisDoDia}
              onEvento={setDetalhe}
              onSlot={(dia) =>
                setCriando({
                  dia,
                  horaInicio: "09:00",
                  horaFim: "10:00",
                  diaInteiro: true,
                })
              }
            />
          ) : (
            <VisaoTempo
              dias={dias}
              hojeKey={hojeKey}
              ocorrencias={filtradas}
              agora={agora}
              onEvento={setDetalhe}
              onSlot={(dia, hora) =>
                setCriando({
                  dia,
                  horaInicio: `${String(hora).padStart(2, "0")}:00`,
                  horaFim: `${String(Math.min(23, hora + 1)).padStart(2, "0")}:00`,
                })
              }
            />
          )}
        </div>
      </div>

      {criando && (
        <EventoDialog
          aberto
          onOpenChange={fecharCriacao}
          calendarios={calendarios}
          inicial={criando}
        />
      )}

      {editando && (
        <EventoDialog
          key={editando.eventId + editando.dayKey}
          aberto
          onOpenChange={(v) => !v && setEditando(null)}
          calendarios={calendarios}
          editando={editando}
        />
      )}

      <EventoDetalhe
        ocorrencia={detalhe}
        onOpenChange={(v) => !v && setDetalhe(null)}
        onEditar={abrirEdicao}
        formatarPeriodo={(oc) =>
          oc.diaInteiro
            ? format(sp(oc.inicio), "EEEE, d 'de' MMMM", { locale: ptBR })
            : `${format(sp(oc.inicio), "EEEE, d 'de' MMMM", {
                locale: ptBR,
              })} ⋅ ${hhmm(oc.inicio)} – ${hhmm(oc.fim)}`
        }
        formatarNota={(iso) => format(sp(iso), "d MMM, HH:mm", { locale: ptBR })}
      />
    </div>
  );
}

function MiniCalendario({
  ancora,
  hojeKey,
  onSelecionar,
}: {
  ancora: Date;
  hojeKey: string;
  onSelecionar: (dia: string) => void;
}) {
  const [mes, setMes] = useState(startOfMonth(ancora));
  useEffect(() => setMes(startOfMonth(ancora)), [ancora]);

  const dias = eachDayOfInterval({
    start: startOfWeek(startOfMonth(mes), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(mes), { weekStartsOn: 0 }),
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[13px] capitalize text-ice">
          {format(mes, "MMMM yyyy", { locale: ptBR })}
        </p>
        <div className="flex items-center gap-0.5">
          <button
            aria-label="Mês anterior"
            onClick={() => setMes(subMonths(mes, 1))}
            className="rounded-full p-1 text-steel hover:text-ice"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <button
            aria-label="Próximo mês"
            onClick={() => setMes(addMonths(mes, 1))}
            className="rounded-full p-1 text-steel hover:text-ice"
          >
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-0.5 text-center">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <span key={i} className="py-1 text-[10px] text-steel">
            {d}
          </span>
        ))}
        {dias.map((dia) => {
          const key = chaveDia(dia);
          const hoje = key === hojeKey;
          const selecionado = key === chaveDia(ancora);
          return (
            <button
              key={key}
              onClick={() => onSelecionar(key)}
              className={cn(
                "tabular aspect-square rounded-full text-[11.5px] transition-colors",
                hoje
                  ? "bg-mint font-medium text-[var(--color-bg)]"
                  : selecionado
                  ? "bg-surface-2 text-ice"
                  : isSameMonth(dia, mes)
                  ? "text-mist hover:bg-surface-2"
                  : "text-steel/60 hover:bg-surface-2"
              )}
            >
              {format(dia, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VisaoTempo({
  dias,
  hojeKey,
  ocorrencias,
  agora,
  onEvento,
  onSlot,
}: {
  dias: Date[];
  hojeKey: string;
  ocorrencias: OcorrenciaView[];
  agora: number | null;
  onEvento: (oc: OcorrenciaView) => void;
  onSlot: (dia: string, hora: number) => void;
}) {
  const horas = Array.from({ length: 24 }, (_, i) => i);
  const diaInteiroPorDia = (key: string) =>
    ocorrencias.filter((o) => o.diaInteiro && o.dayKey === key);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* cabeçalho dos dias */}
        <div
          className="grid border-b border-stroke"
          style={{ gridTemplateColumns: `56px repeat(${dias.length}, 1fr)` }}
        >
          <div className="px-2 py-2 text-[10px] text-steel">GMT-03</div>
          {dias.map((dia) => {
            const key = chaveDia(dia);
            const hoje = key === hojeKey;
            return (
              <div key={key} className="border-l border-stroke px-2 py-2 text-center">
                <p className="text-[11px] uppercase text-steel">
                  {format(dia, "EEEEEE", { locale: ptBR })}
                </p>
                <p
                  className={cn(
                    "tabular mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-[14px]",
                    hoje ? "bg-mint font-medium text-[var(--color-bg)]" : "text-ice"
                  )}
                >
                  {format(dia, "d")}
                </p>
              </div>
            );
          })}
        </div>

        {/* faixa de dia inteiro */}
        <div
          className="grid border-b border-stroke"
          style={{ gridTemplateColumns: `56px repeat(${dias.length}, 1fr)` }}
        >
          <div className="px-2 py-1.5 text-[10px] text-steel">Dia inteiro</div>
          {dias.map((dia) => {
            const key = chaveDia(dia);
            return (
              <div key={key} className="min-h-8 border-l border-stroke p-1">
                {diaInteiroPorDia(key).map((oc) => (
                  <button
                    key={oc.chave}
                    onClick={() => onEvento(oc)}
                    className="mb-1 block w-full truncate rounded-[6px] px-2 py-1 text-left text-[11.5px]"
                    style={{
                      background: `color-mix(in srgb, ${oc.cor} 22%, transparent)`,
                      borderLeft: `3px solid ${oc.cor}`,
                      color: "var(--color-ice)",
                    }}
                  >
                    {oc.titulo}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* grade de horas */}
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `56px repeat(${dias.length}, 1fr)` }}
        >
          <div>
            {horas.map((h) => (
              <div
                key={h}
                className="relative border-b border-stroke/60"
                style={{ height: HORA_PX }}
              >
                <span className="tabular absolute -top-2 right-2 text-[10px] text-steel">
                  {h > 0 ? `${String(h).padStart(2, "0")}:00` : ""}
                </span>
              </div>
            ))}
          </div>

          {dias.map((dia) => {
            const key = chaveDia(dia);
            const doDia = ocorrencias.filter((o) => !o.diaInteiro && o.dayKey === key);
            const blocos = distribuir(doDia);
            const ehHoje = key === hojeKey;

            return (
              <div key={key} className="relative border-l border-stroke">
                {horas.map((h) => (
                  <button
                    key={h}
                    aria-label={`Criar evento às ${h}:00`}
                    onClick={() => onSlot(key, h)}
                    className="block w-full border-b border-stroke/60 transition-colors hover:bg-surface-2/40"
                    style={{ height: HORA_PX }}
                  />
                ))}

                {blocos.map(({ oc, col, cols }) => {
                  const ini = minutosDoDia(oc.inicio);
                  const fim = Math.max(minutosDoDia(oc.fim), ini + 30);
                  return (
                    <button
                      key={oc.chave}
                      onClick={() => onEvento(oc)}
                      className="absolute overflow-hidden rounded-[8px] px-2 py-1 text-left"
                      style={{
                        top: (ini / 60) * HORA_PX,
                        height: ((fim - ini) / 60) * HORA_PX - 2,
                        left: `calc(${(col / cols) * 100}% + 2px)`,
                        width: `calc(${100 / cols}% - 4px)`,
                        background: `color-mix(in srgb, ${oc.cor} 24%, transparent)`,
                        borderLeft: `3px solid ${oc.cor}`,
                      }}
                    >
                      <span className="block truncate text-[11.5px] text-ice">
                        {oc.titulo}
                      </span>
                      <span className="tabular block truncate text-[10.5px] text-mist">
                        {hhmm(oc.inicio)}
                      </span>
                    </button>
                  );
                })}

                {ehHoje && agora != null && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
                    style={{ top: (agora / 60) * HORA_PX }}
                  >
                    <span className="h-2 w-2 -translate-x-1 rounded-full bg-coral" />
                    <span className="h-px flex-1 bg-coral" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function VisaoMes({
  dias,
  ancora,
  hojeKey,
  ocorrencias,
  maisDoDia,
  setMaisDoDia,
  onEvento,
  onSlot,
}: {
  dias: Date[];
  ancora: Date;
  hojeKey: string;
  ocorrencias: OcorrenciaView[];
  maisDoDia: string | null;
  setMaisDoDia: (v: string | null) => void;
  onEvento: (oc: OcorrenciaView) => void;
  onSlot: (dia: string) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-stroke">
        {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => (
          <span key={d} className="py-2 text-center text-[11px] uppercase text-steel">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {dias.map((dia) => {
          const key = chaveDia(dia);
          const doDia = ocorrencias.filter((o) => o.dayKey === key);
          const visiveis = doDia.slice(0, 3);
          const restantes = doDia.length - visiveis.length;
          const hoje = key === hojeKey;

          return (
            <div
              key={key}
              className={cn(
                "min-h-[112px] border-b border-l border-stroke p-1.5 first:border-l-0",
                !isSameMonth(dia, ancora) && "bg-bg/40"
              )}
            >
              <button
                onClick={() => onSlot(key)}
                className={cn(
                  "tabular mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[12px] transition-colors",
                  hoje
                    ? "bg-mint font-medium text-[var(--color-bg)]"
                    : isSameMonth(dia, ancora)
                    ? "text-mist hover:bg-surface-2"
                    : "text-steel/60 hover:bg-surface-2"
                )}
              >
                {format(dia, "d")}
              </button>

              <div className="flex flex-col gap-0.5">
                {visiveis.map((oc) => (
                  <button
                    key={oc.chave}
                    onClick={() => onEvento(oc)}
                    className="flex items-center gap-1.5 rounded-[6px] px-1.5 py-0.5 text-left transition-colors hover:bg-surface-2"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: oc.cor }}
                    />
                    <span className="truncate text-[11px] text-mist">{oc.titulo}</span>
                    {!oc.diaInteiro && (
                      <span className="tabular ml-auto shrink-0 text-[10px] text-steel">
                        {hhmm(oc.inicio)}
                      </span>
                    )}
                  </button>
                ))}

                {restantes > 0 && (
                  <Popover
                    open={maisDoDia === key}
                    onOpenChange={(v) => setMaisDoDia(v ? key : null)}
                  >
                    <PopoverTrigger asChild>
                      <button className="px-1.5 text-left text-[10.5px] text-steel hover:text-mint">
                        +{restantes} mais
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[240px]">
                      <p className="microlabel">
                        {format(dia, "d 'de' MMMM", { locale: ptBR })}
                      </p>
                      <div className="mt-2 flex flex-col">
                        {doDia.map((oc) => (
                          <button
                            key={oc.chave}
                            onClick={() => {
                              setMaisDoDia(null);
                              onEvento(oc);
                            }}
                            className="flex items-center gap-2 rounded-[6px] px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2"
                          >
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ background: oc.cor }}
                            />
                            <span className="truncate text-[12px] text-mist">
                              {oc.titulo}
                            </span>
                            {!oc.diaInteiro && (
                              <span className="tabular ml-auto text-[10.5px] text-steel">
                                {hhmm(oc.inicio)}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
