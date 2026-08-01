"use client";

import { useState, useTransition } from "react";
import { useAcao } from "@/lib/acao-cliente";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Footprints,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CardLabel } from "@/components/caverna/card";
import { DotsMenu } from "@/components/caverna/dots-menu";
import { EmptyState } from "@/components/caverna/empty-state";
import {
  createRunRoutine,
  createRunSession,
  deleteRunRoutine,
  deleteRunSession,
  duplicateRunRoutine,
  moveRunSession,
  resetRunSessionWeek,
  setRunRoutineDias,
  setRunSessionWeek,
  setSemanaAtual,
  updateRunRoutine,
  updateRunSession,
  updateRunSessionMeta,
  type RunSessionInput,
} from "@/app/actions/treinos";
import type { PlanoCorridaView, SessaoCorridaView } from "@/lib/data/treinos-format";
import { DIAS_SEMANA_LABEL, formatDiasSemana, formatDistancia } from "@/lib/data/treinos-format";
import { cn } from "@/lib/utils";

const tipos = ["Leve", "Moderado", "Intervalado", "Longão"];

const sessaoVazia: RunSessionInput = { nome: "", tipo: "Leve", kmAlvo: 5 };

export function PlanoCorridaClient({
  planos,
  semana,
}: {
  planos: PlanoCorridaView[];
  semana: number;
}) {
  const [, executar] = useAcao();
  const [pending, startSalvar] = useTransition();

  const [sheetPlano, setSheetPlano] = useState(false);
  const [planoEditandoId, setPlanoEditandoId] = useState<string | null>(null);
  const [formPlano, setFormPlano] = useState<{ nome: string; foco: string; dias: number[] }>({
    nome: "",
    foco: "",
    dias: [],
  });

  const [sheetSessao, setSheetSessao] = useState<{
    routineId: string;
    id: string | null;
    herdado: boolean;
    origem: number;
  } | null>(null);
  const [formSessao, setFormSessao] = useState<RunSessionInput>(sessaoVazia);

  function abrirPlano(p: PlanoCorridaView | null) {
    setPlanoEditandoId(p?.id ?? null);
    setFormPlano({ nome: p?.nome ?? "", foco: p?.foco ?? "", dias: p?.diasSemana ?? [] });
    setSheetPlano(true);
  }

  function salvarPlano() {
    startSalvar(async () => {
      if (planoEditandoId) {
        await updateRunRoutine(planoEditandoId, formPlano.nome, formPlano.foco);
        await setRunRoutineDias(planoEditandoId, formPlano.dias);
        toast.success("Plano atualizado");
      } else {
        const novoId = await createRunRoutine(formPlano.nome, formPlano.foco);
        if (formPlano.dias.length > 0) await setRunRoutineDias(novoId, formPlano.dias);
        toast.success("Plano criado");
      }
      setSheetPlano(false);
    });
  }

  function abrirSessao(routineId: string, s: SessaoCorridaView | null) {
    setSheetSessao({
      routineId,
      id: s?.id ?? null,
      herdado: s?.herdado ?? false,
      origem: s?.origemSemana ?? 1,
    });
    setFormSessao(
      s
        ? { nome: s.nome, tipo: s.tipo, kmAlvo: s.kmAlvoSemana }
        : sessaoVazia
    );
  }

  // Da semana 2 em diante o km-alvo vira override daquela semana (setRunSessionWeek)
  // e nome/tipo (que não variam) vão por updateRunSessionMeta — sem tocar a base.
  function salvarSessao() {
    if (!sheetSessao) return;
    startSalvar(async () => {
      if (sheetSessao.id) {
        if (semana > 1) {
          await setRunSessionWeek(sheetSessao.id, semana, formSessao.kmAlvo);
          await updateRunSessionMeta(sheetSessao.id, {
            nome: formSessao.nome,
            tipo: formSessao.tipo,
          });
          toast.success(`Semana ${semana} atualizada`);
        } else {
          await updateRunSession(sheetSessao.id, formSessao);
          toast.success("Sessão atualizada");
        }
      } else {
        await createRunSession(sheetSessao.routineId, formSessao);
        toast.success("Sessão adicionada");
      }
      setSheetSessao(null);
    });
  }

  function resetarSemana() {
    if (!sheetSessao?.id || semana <= 1) return;
    startSalvar(async () => {
      await resetRunSessionWeek(sheetSessao.id!, semana);
      toast.success(`Semana ${semana} voltou a herdar`);
      setSheetSessao(null);
    });
  }

  function mudarSemana(delta: number) {
    const alvo = Math.max(1, semana + delta);
    if (alvo === semana) return;
    executar(() => setSemanaAtual(alvo));
  }

  if (planos.length === 0) {
    return (
      <>
        <EmptyState
          icon={Footprints}
          title="Nenhum plano de corrida ainda"
          description="Crie um plano com sessões e progressão de km por semana."
          className="py-12"
          action={
            <Button variant="dashed" size="sm" onClick={() => abrirPlano(null)}>
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Criar plano
            </Button>
          }
        />
        <SheetPlano
          aberto={sheetPlano}
          onOpenChange={setSheetPlano}
          editando={!!planoEditandoId}
          form={formPlano}
          setForm={setFormPlano}
          onSalvar={salvarPlano}
          pending={pending}
        />
      </>
    );
  }

  return (
    <>
      <SeletorSemana semana={semana} onMudar={mudarSemana} />

      <div className="mt-4 flex flex-col gap-4">
        {planos.map((plano) => (
          <div key={plano.id} className="rounded-[16px] border border-stroke bg-surface-2/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardLabel>{plano.foco ?? "Sem foco definido"}</CardLabel>
                <p className="mt-1.5 text-[15px] text-paper">{plano.nome}</p>
                <p className="mt-1 text-[11.5px] text-steel">
                  {formatDiasSemana(plano.diasSemana)}
                </p>
              </div>
              <DotsMenu
                items={[
                  { label: "Editar plano", icon: Pencil, onSelect: () => abrirPlano(plano) },
                  {
                    label: "Duplicar",
                    icon: Copy,
                    onSelect: () =>
                      executar(async () => {
                        await duplicateRunRoutine(plano.id);
                        toast.success("Plano duplicado");
                      }),
                  },
                  {
                    label: "Excluir",
                    icon: Trash2,
                    destructive: true,
                    onSelect: () =>
                      executar(async () => {
                        await deleteRunRoutine(plano.id);
                        toast.success("Plano excluído");
                      }),
                  },
                ]}
              />
            </div>

            <div className="mt-4 flex flex-col">
              {plano.sessoes.length === 0 ? (
                <p className="py-2 text-[13px] text-steel">Nenhuma sessão neste plano.</p>
              ) : (
                plano.sessoes.map((s, i) => (
                  <div
                    key={s.id}
                    className="group flex items-center gap-3 border-b border-stroke py-2.5 last:border-0"
                  >
                    {s.cumprida ? (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint text-[var(--color-bg)]">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="h-5 w-5 shrink-0 rounded-full border border-stroke" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13.5px] text-ice">{s.nome}</p>
                        <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10.5px] text-mist">
                          {s.tipo}
                        </span>
                        {s.herdado && semana > 1 && (
                          <span className="shrink-0 text-[10.5px] text-steel">
                            herda sem. {s.origemSemana}
                          </span>
                        )}
                      </div>
                      <p className="tabular text-[11.5px] text-steel">
                        alvo {formatDistancia(s.kmAlvoSemana)}
                        {s.cumprida && ` · feito ${formatDistancia(s.cumprida.km)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        aria-label="Subir sessão"
                        disabled={i === 0}
                        onClick={() => executar(() => moveRunSession(s.id, -1))}
                        className="rounded-md p-1 text-steel hover:text-ice disabled:opacity-30"
                      >
                        <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        aria-label="Descer sessão"
                        disabled={i === plano.sessoes.length - 1}
                        onClick={() => executar(() => moveRunSession(s.id, 1))}
                        className="rounded-md p-1 text-steel hover:text-ice disabled:opacity-30"
                      >
                        <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        aria-label="Editar sessão"
                        onClick={() => abrirSessao(plano.id, s)}
                        className="rounded-md p-1 text-steel hover:text-ice"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        aria-label="Excluir sessão"
                        onClick={() =>
                          executar(async () => {
                            await deleteRunSession(s.id);
                            toast.success("Sessão excluída");
                          })
                        }
                        className="rounded-md p-1 text-steel hover:text-coral"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Button
              variant="dashed"
              size="sm"
              className="mt-3 w-full"
              onClick={() => abrirSessao(plano.id, null)}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              Adicionar sessão
            </Button>
          </div>
        ))}

        <div>
          <Button variant="dashed" size="sm" onClick={() => abrirPlano(null)}>
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Criar plano
          </Button>
        </div>
      </div>

      <SheetPlano
        aberto={sheetPlano}
        onOpenChange={setSheetPlano}
        editando={!!planoEditandoId}
        form={formPlano}
        setForm={setFormPlano}
        onSalvar={salvarPlano}
        pending={pending}
      />

      <Sheet open={!!sheetSessao} onOpenChange={(v) => !v && setSheetSessao(null)}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>
            {sheetSessao?.id
              ? semana > 1
                ? `Editar sessão · Semana ${semana}`
                : "Editar sessão"
              : "Nova sessão"}
          </SheetTitle>
          {sheetSessao?.id && semana > 1 && (
            <div className="mt-4 rounded-[12px] border border-stroke bg-surface-2 px-3.5 py-3">
              <p className="text-[12px] text-mist">
                {sheetSessao.herdado
                  ? `O km-alvo está herdando da semana ${sheetSessao.origem}. Editar cria uma versão própria para a semana ${semana} (e as seguintes até você mudar de novo).`
                  : `Você está editando a versão da semana ${semana}. Nome e tipo valem para todas as semanas.`}
              </p>
              {!sheetSessao.herdado && (
                <button
                  onClick={resetarSemana}
                  className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-steel hover:text-ice"
                >
                  <RotateCcw className="h-3 w-3" strokeWidth={1.5} />
                  Resetar semana {semana} (voltar a herdar)
                </button>
              )}
            </div>
          )}
          <div className="mt-6 flex flex-col gap-5">
            <div>
              <Label htmlFor="sess-nome">Nome</Label>
              <Input
                id="sess-nome"
                value={formSessao.nome}
                onChange={(e) => setFormSessao({ ...formSessao, nome: e.target.value })}
                placeholder="Longão de domingo, Tiros na pista…"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={formSessao.tipo}
                  onValueChange={(v) => setFormSessao({ ...formSessao, tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tipos.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sess-km">
                  Km alvo{semana > 1 ? ` · sem. ${semana}` : ""}
                </Label>
                <Input
                  id="sess-km"
                  inputMode="decimal"
                  value={String(formSessao.kmAlvo)}
                  onChange={(e) =>
                    setFormSessao({
                      ...formSessao,
                      kmAlvo: Number(e.target.value.replace(",", ".")) || 0,
                    })
                  }
                  className="tabular"
                  placeholder="8"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={salvarSessao}
                disabled={!formSessao.nome.trim() || pending}
              >
                {pending ? "Salvando…" : "Salvar"}
              </Button>
              <Button variant="ghost" onClick={() => setSheetSessao(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function SheetPlano({
  aberto,
  onOpenChange,
  editando,
  form,
  setForm,
  onSalvar,
  pending,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  editando: boolean;
  form: { nome: string; foco: string; dias: number[] };
  setForm: (v: { nome: string; foco: string; dias: number[] }) => void;
  onSalvar: () => void;
  pending: boolean;
}) {
  function toggleDia(d: number) {
    setForm({
      ...form,
      dias: form.dias.includes(d) ? form.dias.filter((x) => x !== d) : [...form.dias, d],
    });
  }
  return (
    <Sheet open={aberto} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>{editando ? "Editar plano" : "Novo plano de corrida"}</SheetTitle>
        <div className="mt-6 flex flex-col gap-5">
          <div>
            <Label htmlFor="plano-nome">Nome</Label>
            <Input
              id="plano-nome"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Base 5k"
            />
          </div>
          <div>
            <Label htmlFor="plano-foco">Foco</Label>
            <Input
              id="plano-foco"
              value={form.foco}
              onChange={(e) => setForm({ ...form, foco: e.target.value })}
              placeholder="Resistência aeróbica"
            />
          </div>
          <div>
            <Label>Dias da semana</Label>
            <div className="mt-1.5 flex gap-1.5">
              {DIAS_SEMANA_LABEL.map((label, d) => {
                const on = form.dias.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDia(d)}
                    aria-pressed={on}
                    className={cn(
                      "h-9 flex-1 rounded-[10px] border text-[11.5px] font-medium transition-colors",
                      on
                        ? "border-[var(--mint-border)] bg-mint-soft text-mint"
                        : "border-stroke bg-surface-2 text-steel hover:text-ice"
                    )}
                  >
                    {label.slice(0, 1)}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-steel">
              Quais dias este plano roda (ex.: Ter, Qui e Sáb).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={onSalvar} disabled={!form.nome.trim() || pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SeletorSemana({
  semana,
  onMudar,
}: {
  semana: number;
  onMudar: (delta: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-[14px] border border-stroke bg-surface-2 px-3 py-2.5">
      <div>
        <CardLabel>Periodização · corrida</CardLabel>
        <p className="mt-0.5 text-[14px] text-paper">Semana {semana}</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          aria-label="Semana anterior"
          disabled={semana <= 1}
          onClick={() => onMudar(-1)}
          className="rounded-[10px] border border-stroke p-2 text-steel transition-colors hover:text-ice disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <button
          aria-label="Próxima semana"
          onClick={() => onMudar(1)}
          className="rounded-[10px] border border-stroke p-2 text-steel transition-colors hover:text-ice"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
