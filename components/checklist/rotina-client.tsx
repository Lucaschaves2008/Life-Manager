"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { ArrowDown, ArrowUp, CalendarDays, Check, Clock, GripVertical, Pencil, Plus, SkipForward, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DotsMenu } from "@/components/caverna/dots-menu";
import { EmptyState } from "@/components/caverna/empty-state";
import {
  atualizarRotinaTemplate,
  criarRotinaPlano,
  criarRotinaTemplate,
  definirRotinaPlanoPadrao,
  escolherRotinaPlanoDoDia,
  excluirRotinaPlano,
  excluirRotinaTemplate,
  moverRotinaTemplate,
  pularRotinaHoje,
  renomearRotinaPlano,
  reordenarRotinaTemplates,
  toggleRotinaCheckDia,
  type RotinaTemplateInput,
} from "@/app/actions/rotinas";
import type {
  RotinaOcorrenciaView,
  RotinaOpcao,
  RotinaPlanoView,
  RotinaTemplateView,
  TipoRotina,
} from "@/lib/data/rotinas";
import type { CategoriaView } from "@/lib/data/estudos";
import type { SessaoCorridaOpcao } from "@/lib/data/treinos-format";
import { formatHoras } from "@/lib/data/estudos-format";
import { cn } from "@/lib/utils";

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

const TIPO_META: Record<TipoRotina, { label: string; emoji: string }> = {
  livre: { label: "Livre", emoji: "•" },
  estudo: { label: "Estudo", emoji: "📚" },
  treino: { label: "Treino", emoji: "💪" },
  corrida: { label: "Corrida", emoji: "🏃" },
};

const METAS = [
  { label: "Sem meta", min: null },
  { label: "25 min", min: 25 },
  { label: "45 min", min: 45 },
  { label: "1h", min: 60 },
  { label: "1h30", min: 90 },
  { label: "2h", min: 120 },
];

type TipoRecorrencia = "nunca" | "todoDia" | "diasSemana" | "intervalo";

type FormState = {
  id: string | null;
  nome: string;
  horaInicio: string;
  horaFim: string;
  tipoRecorrencia: TipoRecorrencia;
  diasSemana: number[];
  dataFim: string;
  tipo: TipoRotina;
  studyCategoryId: string;
  routineId: string;
  runSessionId: string;
  metaMinutos: number | null;
  planoId: string;
};

function formVazio(planoId: string = ""): FormState {
  return {
    id: null,
    nome: "",
    horaInicio: "",
    horaFim: "",
    tipoRecorrencia: "nunca",
    diasSemana: [],
    dataFim: "",
    tipo: "livre",
    studyCategoryId: "",
    routineId: "",
    runSessionId: "",
    metaMinutos: null,
    planoId,
  };
}

function rrulePara(rrule: string | null): { tipo: TipoRecorrencia; diasSemana: number[]; dataFim: string } {
  if (!rrule) return { tipo: "nunca", diasSemana: [], dataFim: "" };
  try {
    const r = JSON.parse(rrule) as { freq: string; byday?: number[]; until?: string };
    const dataFim = r.until ? r.until.slice(0, 10) : "";
    if (r.freq === "weekly" && r.byday && r.byday.length > 0) {
      return { tipo: "diasSemana", diasSemana: r.byday, dataFim };
    }
    return { tipo: dataFim ? "intervalo" : "todoDia", diasSemana: [], dataFim };
  } catch {
    return { tipo: "nunca", diasSemana: [], dataFim: "" };
  }
}

export function MinhaRotina({
  ocorrencias,
  templates,
  categorias,
  rotinasTreino,
  sessoesCorrida,
  planos,
  planoAtivoId,
  dia,
}: {
  ocorrencias: RotinaOcorrenciaView[];
  templates: RotinaTemplateView[];
  categorias: CategoriaView[];
  rotinasTreino: RotinaOpcao[];
  sessoesCorrida: SessaoCorridaOpcao[];
  planos: RotinaPlanoView[];
  planoAtivoId: string | null;
  /** yyyy-MM-dd */
  dia: string;
}) {
  const [pending, startTransition] = useTransition();
  const [gerenciar, setGerenciar] = useState(false);
  const [gerenciarPlanos, setGerenciarPlanos] = useState(false);
  const [novoPlanoNome, setNovoPlanoNome] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [ordemOtimista, setOrdemOtimista] = useState(ocorrencias);

  useEffect(() => {
    setOrdemOtimista(ocorrencias);
  }, [ocorrencias]);

  const catPorId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

  function toggle(templateId: string) {
    setOrdemOtimista((atuais) =>
      atuais.map((oc) =>
        oc.templateId === templateId
          ? { ...oc, feito: !oc.feito, feitoAuto: false }
          : oc
      )
    );
    startTransition(() => toggleRotinaCheckDia(templateId, dia));
  }

  function reordenar(deIndex: number, paraIndex: number) {
    if (deIndex === paraIndex) return;
    const proxima = ordemOtimista.slice();
    const [item] = proxima.splice(deIndex, 1);
    proxima.splice(paraIndex, 0, item);
    setOrdemOtimista(proxima);
    startTransition(async () => {
      await reordenarRotinaTemplates(proxima.map((o) => o.templateId));
    });
  }

  function pular(templateId: string) {
    startTransition(async () => {
      await pularRotinaHoje(templateId, dia);
      toast.success("Item pulado hoje");
    });
  }

  function abrirNovo() {
    setForm(formVazio(planoAtivoId ?? ""));
  }

  function abrirEdicao(t: RotinaTemplateView) {
    const { tipo, diasSemana, dataFim } = rrulePara(t.rrule);
    setForm({
      id: t.id,
      nome: t.nome,
      horaInicio: t.horaInicio ?? "",
      horaFim: t.horaFim ?? "",
      tipoRecorrencia: tipo,
      diasSemana,
      dataFim,
      tipo: t.tipo,
      studyCategoryId: t.studyCategoryId ?? "",
      routineId: t.routineId ?? "",
      runSessionId: t.runSessionId ?? "",
      metaMinutos: t.metaMinutos,
      planoId: t.planoId ?? "",
    });
  }

  function salvar() {
    if (!form) return;
    const nome = form.nome.trim();
    if (!nome) return;
    const payload: RotinaTemplateInput = {
      nome,
      horaInicio: form.horaInicio || null,
      horaFim: form.horaFim || null,
      dataInicio: dia,
      tipoRecorrencia: form.tipoRecorrencia,
      diasSemana: form.tipoRecorrencia === "diasSemana" ? form.diasSemana : undefined,
      dataFim: form.dataFim || null,
      tipo: form.tipo,
      studyCategoryId: form.tipo === "estudo" ? form.studyCategoryId || null : null,
      routineId: form.tipo === "treino" ? form.routineId || null : null,
      runSessionId: form.tipo === "corrida" ? form.runSessionId || null : null,
      metaMinutos: form.tipo === "estudo" || form.tipo === "corrida" ? form.metaMinutos : null,
      planoId: form.planoId || null,
    };
    startTransition(async () => {
      try {
        if (form.id) await atualizarRotinaTemplate(form.id, payload);
        else await criarRotinaTemplate(payload);
        setForm(null);
        toast.success(form.id ? "Item atualizado" : "Item adicionado ao checklist");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
      }
    });
  }

  function excluir(id: string) {
    startTransition(async () => {
      await excluirRotinaTemplate(id);
      toast.success("Item removido");
    });
  }

  function escolherPlano(planoId: string) {
    startTransition(async () => {
      await escolherRotinaPlanoDoDia(dia, planoId);
    });
  }

  function criarPlano() {
    const nome = novoPlanoNome.trim();
    if (!nome) return;
    startTransition(async () => {
      await criarRotinaPlano(nome);
      setNovoPlanoNome("");
      toast.success("Plano criado");
    });
  }

  function renomearPlano(id: string, nomeAtual: string) {
    const nome = window.prompt("Novo nome do plano", nomeAtual);
    if (!nome || !nome.trim() || nome === nomeAtual) return;
    startTransition(() => renomearRotinaPlano(id, nome));
  }

  function tornarPadrao(id: string) {
    startTransition(() => definirRotinaPlanoPadrao(id));
  }

  function excluirPlano(id: string) {
    startTransition(async () => {
      await excluirRotinaPlano(id);
      toast.success("Plano removido");
    });
  }

  const planoAtivo = planos.find((p) => p.id === planoAtivoId);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="microlabel">Checklist de hoje</p>
        <div className="flex flex-wrap items-center gap-2">
          {planos.length > 0 && (
            <Select value={planoAtivoId ?? undefined} onValueChange={escolherPlano}>
              <SelectTrigger className="h-8 w-auto min-w-[9rem] text-[12.5px]">
                <SelectValue placeholder="Plano do dia">
                  {planoAtivo ? `Hoje: ${planoAtivo.nome}` : "Plano do dia"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {planos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                    {p.padrao ? " (padrão)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={() => setGerenciarPlanos(true)}>
            Planos
          </Button>
          <Button variant="outline" size="sm" onClick={() => setGerenciar(true)}>
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
            Gerenciar
          </Button>
          <Button variant="outline" size="sm" onClick={abrirNovo}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Adicionar
          </Button>
        </div>
      </div>

      <div className="mt-4">
        {ordemOtimista.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nenhum item planejado para hoje. Adicione um treino, estudo ou tarefa e organize seu dia."
            className="py-12"
          />
        ) : (
          <ListaArrastavel itens={ordemOtimista} onReordenar={reordenar}>
            {(oc) => (
              <ItemLinha
                item={oc}
                categoria={oc.studyCategoryId ? catPorId.get(oc.studyCategoryId) : undefined}
                onToggle={() => toggle(oc.templateId)}
                onEditar={() => {
                  const t = templates.find((tt) => tt.id === oc.templateId);
                  if (t) abrirEdicao(t);
                }}
                onPular={() => pular(oc.templateId)}
              />
            )}
          </ListaArrastavel>
        )}
      </div>

      {/* Sheet: gerenciar templates */}
      <Sheet open={gerenciar} onOpenChange={setGerenciar}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>Gerenciar checklist</SheetTitle>
          <div className="mt-6 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              {templates.length === 0 && (
                <p className="text-[12.5px] text-steel">Nenhum item cadastrado ainda.</p>
              )}
              {templates.map((t, i) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 rounded-[14px] border border-stroke bg-surface-2 px-3 py-2.5"
                >
                  <span className="text-[14px]">{(TIPO_META[t.tipo] ?? TIPO_META.livre).emoji}</span>
                  <span className="tabular w-24 shrink-0 text-[12px] text-steel">
                    {t.horaInicio ? `${t.horaInicio}${t.horaFim ? `–${t.horaFim}` : ""}` : "–"}
                  </span>
                  <span className="flex-1 truncate text-[13px] text-ice">{t.nome}</span>
                  {planos.length > 0 && (
                    <span className="shrink-0 text-[11px] text-steel">
                      {t.planoId ? planos.find((p) => p.id === t.planoId)?.nome ?? "" : "comum"}
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Subir"
                      disabled={i === 0}
                      onClick={() => startTransition(() => moverRotinaTemplate(t.id, -1))}
                      className="rounded-full p-1.5 text-steel transition-colors hover:bg-surface hover:text-ice disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      aria-label="Descer"
                      disabled={i === templates.length - 1}
                      onClick={() => startTransition(() => moverRotinaTemplate(t.id, 1))}
                      className="rounded-full p-1.5 text-steel transition-colors hover:bg-surface hover:text-ice disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                    <DotsMenu
                      items={[
                        { label: "Editar", icon: Pencil, onSelect: () => abrirEdicao(t) },
                        {
                          label: "Excluir",
                          icon: Trash2,
                          destructive: true,
                          onSelect: () => excluir(t.id),
                        },
                      ]}
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button variant="outline" onClick={abrirNovo}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Novo item
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: gerenciar planos (Plano A/B/C...) */}
      <Sheet open={gerenciarPlanos} onOpenChange={setGerenciarPlanos}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>Planos da rotina</SheetTitle>
          <p className="mt-1 text-[12.5px] text-steel">
            Cadastre planos alternativos (ex.: &quot;Normal&quot;, &quot;Dia ruim&quot;). Itens sem
            plano definido aparecem em qualquer um.
          </p>
          <div className="mt-6 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              {planos.length === 0 && (
                <p className="text-[12.5px] text-steel">Nenhum plano cadastrado ainda.</p>
              )}
              {planos.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-[14px] border border-stroke bg-surface-2 px-3 py-2.5"
                >
                  <span className="flex-1 truncate text-[13px] text-ice">{p.nome}</span>
                  {p.padrao && (
                    <span className="flex items-center gap-1 text-[11px] text-mint">
                      <Star className="h-3 w-3" strokeWidth={1.5} />
                      padrão
                    </span>
                  )}
                  <DotsMenu
                    items={[
                      { label: "Renomear", icon: Pencil, onSelect: () => renomearPlano(p.id, p.nome) },
                      ...(!p.padrao
                        ? [{ label: "Definir como padrão", icon: Check, onSelect: () => tornarPadrao(p.id) }]
                        : []),
                      {
                        label: "Excluir",
                        icon: Trash2,
                        destructive: true,
                        onSelect: () => excluirPlano(p.id),
                      },
                    ]}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Input
                value={novoPlanoNome}
                onChange={(e) => setNovoPlanoNome(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && criarPlano()}
                placeholder="Ex.: Dia ruim, Viagem…"
              />
              <Button variant="outline" onClick={criarPlano} disabled={pending}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Criar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: criar/editar template */}
      <Sheet open={form !== null} onOpenChange={(v) => !v && setForm(null)}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>{form?.id ? "Editar item" : "Novo item do checklist"}</SheetTitle>
          {form && (
            <div className="mt-6 flex flex-col gap-5">
              {/* Tipo */}
              <div>
                <Label>Tipo</Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(TIPO_META) as TipoRotina[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, tipo: t })}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors",
                        form.tipo === t
                          ? "border-[rgba(13,110,253,.4)] bg-mint-soft text-mint"
                          : "border-stroke text-mist hover:border-[rgba(143,169,205,.22)]"
                      )}
                    >
                      <span>{TIPO_META[t].emoji}</span>
                      {TIPO_META[t].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nome */}
              <div>
                <Label htmlFor="rotina-nome">Nome</Label>
                <Input
                  id="rotina-nome"
                  autoFocus
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && salvar()}
                  placeholder="Ex.: Estudar inglês, Treino de peito, Acordar…"
                />
              </div>

              {/* Categoria de estudo (só tipo estudo) */}
              {form.tipo === "estudo" && (
                <div>
                  <Label>Categoria de estudo</Label>
                  {categorias.length === 0 ? (
                    <p className="text-[12.5px] text-steel">
                      Cadastre categorias na aba de estudos para conectar o cronômetro.
                    </p>
                  ) : (
                    <Select
                      value={form.studyCategoryId || undefined}
                      onValueChange={(v) => setForm({ ...form, studyCategoryId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.emoji} {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Rotina (só tipo treino) */}
              {form.tipo === "treino" && (
                <div>
                  <Label>Rotina de treino</Label>
                  {rotinasTreino.length === 0 ? (
                    <p className="text-[12.5px] text-steel">Cadastre rotinas em Treinos para vincular.</p>
                  ) : (
                    <Select
                      value={form.routineId || undefined}
                      onValueChange={(v) => setForm({ ...form, routineId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha a rotina" />
                      </SelectTrigger>
                      <SelectContent>
                        {rotinasTreino.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.nome}
                            {r.foco ? ` · ${r.foco}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Sessão de corrida (só tipo corrida) */}
              {form.tipo === "corrida" && (
                <div>
                  <Label>Sessão de corrida</Label>
                  {sessoesCorrida.length === 0 ? (
                    <p className="text-[12.5px] text-steel">
                      Crie um plano de corrida em Treinos para vincular uma sessão.
                    </p>
                  ) : (
                    <Select
                      value={form.runSessionId || undefined}
                      onValueChange={(v) => setForm({ ...form, runSessionId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha a sessão" />
                      </SelectTrigger>
                      <SelectContent>
                        {sessoesCorrida.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.nome} · {s.tipo}
                            <span className="text-steel"> ({s.planoNome})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Meta de tempo (estudo/corrida) */}
              {(form.tipo === "estudo" || form.tipo === "corrida") && (
                <div>
                  <Label>Meta de tempo</Label>
                  <div className="flex flex-wrap gap-2">
                    {METAS.map((m) => (
                      <button
                        key={m.label}
                        type="button"
                        onClick={() => setForm({ ...form, metaMinutos: m.min })}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
                          form.metaMinutos === m.min
                            ? "border-[rgba(13,110,253,.4)] bg-mint-soft text-mint"
                            : "border-stroke text-mist hover:border-[rgba(143,169,205,.22)]"
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Horário (início/fim, ambos opcionais) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rotina-ini">Início (opcional)</Label>
                  <Input
                    id="rotina-ini"
                    type="time"
                    value={form.horaInicio}
                    onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
                    className="tabular"
                  />
                </div>
                <div>
                  <Label htmlFor="rotina-fim">Fim (opcional)</Label>
                  <Input
                    id="rotina-fim"
                    type="time"
                    value={form.horaFim}
                    onChange={(e) => setForm({ ...form, horaFim: e.target.value })}
                    className="tabular"
                  />
                </div>
              </div>

              {/* Repetição */}
              <div>
                <Label>Repetição</Label>
                <Select
                  value={form.tipoRecorrencia}
                  onValueChange={(v) => setForm({ ...form, tipoRecorrencia: v as TipoRecorrencia })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nunca">Não se repete</SelectItem>
                    <SelectItem value="todoDia">Todo dia</SelectItem>
                    <SelectItem value="diasSemana">Dias da semana</SelectItem>
                    <SelectItem value="intervalo">Intervalo de datas</SelectItem>
                  </SelectContent>
                </Select>

                {form.tipoRecorrencia === "diasSemana" && (
                  <div className="mt-3 flex gap-1.5">
                    {DIAS_SEMANA.map((label, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`Dia ${i}`}
                        onClick={() =>
                          setForm({
                            ...form,
                            diasSemana: form.diasSemana.includes(i)
                              ? form.diasSemana.filter((d) => d !== i)
                              : [...form.diasSemana, i],
                          })
                        }
                        className={cn(
                          "h-8 w-8 rounded-full border text-[12px] transition-colors",
                          form.diasSemana.includes(i)
                            ? "border-transparent bg-mint text-[var(--color-bg)]"
                            : "border-stroke text-mist hover:border-mint hover:text-mint"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {(form.tipoRecorrencia === "intervalo" ||
                  form.tipoRecorrencia === "diasSemana" ||
                  form.tipoRecorrencia === "todoDia") && (
                  <div className="mt-3">
                    <Label htmlFor="rotina-data-fim">Até (opcional)</Label>
                    <Input
                      id="rotina-data-fim"
                      type="date"
                      value={form.dataFim}
                      onChange={(e) => setForm({ ...form, dataFim: e.target.value })}
                      className="w-44"
                    />
                  </div>
                )}
              </div>

              {/* Plano (opcional) */}
              {planos.length > 0 && (
                <div>
                  <Label>Plano</Label>
                  <Select
                    value={form.planoId || "comum"}
                    onValueChange={(v) => setForm({ ...form, planoId: v === "comum" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comum">Comum (todos os planos)</SelectItem>
                      {planos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                variant="primary"
                onClick={salvar}
                disabled={pending}
                className="mt-1 h-11 text-[14px]"
              >
                {form.id ? "Salvar" : "Adicionar ao checklist"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function ItemLinha({
  item,
  categoria,
  onToggle,
  onEditar,
  onPular,
}: {
  item: RotinaOcorrenciaView;
  categoria?: CategoriaView;
  onToggle: () => void;
  onEditar: () => void;
  onPular: () => void;
}) {
  const meta = TIPO_META[item.tipo] ?? TIPO_META.livre;
  const emoji = categoria?.emoji ?? meta.emoji;

  // progresso de tempo (estudo com categoria): 47/60 min
  const metaSec = item.metaMinutos ? item.metaMinutos * 60 : 0;
  const temProgresso = item.tipo === "estudo" && item.studyCategoryId != null;
  const pct = metaSec > 0 ? Math.min(100, (item.executadoSec / metaSec) * 100) : 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[14px] border px-4 py-3 transition-colors",
        item.feito
          ? "border-mint/30 bg-mint-soft"
          : "border-stroke bg-surface-2 hover:border-[rgba(143,169,205,.25)]"
      )}
    >
      <span
        data-drag-handle
        aria-label="Arrastar para reordenar"
        className="-ml-1 flex h-8 w-5 shrink-0 cursor-grab touch-none items-center justify-center text-steel/50 transition-colors hover:text-steel active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" strokeWidth={1.5} />
      </span>

      <button
        type="button"
        onClick={onToggle}
        aria-label={item.feito ? "Desmarcar" : "Marcar como feito"}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          item.feito ? "border-mint bg-mint" : "border-stroke hover:border-mint/60"
        )}
      >
        {item.feito && (
          <svg viewBox="0 0 12 12" className="h-3 w-3 fill-none stroke-[var(--color-bg)]">
            <path d="M2 6l2.5 2.5L10 3" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {item.horaInicio ? (
        <span className="tabular w-11 shrink-0 text-[12.5px] text-steel">{item.horaInicio}</span>
      ) : (
        <span className="w-11 shrink-0 text-center text-[12px] text-steel/60">–</span>
      )}

      <span className="text-[15px] leading-none">{emoji}</span>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[13.5px]", item.feito ? "text-ice" : "text-mist")}>
          {item.nome}
          {item.feitoAuto && <span className="ml-2 text-[11px] text-mint">auto</span>}
        </p>
        {temProgresso && item.metaMinutos && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1 w-24 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-mint transition-all duration-500"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
            <span className="tabular text-[11px] text-steel">
              {Math.round(item.executadoSec / 60)}/{item.metaMinutos} min
            </span>
          </div>
        )}
        {temProgresso && !item.metaMinutos && item.executadoSec > 0 && (
          <span className="tabular mt-1 flex items-center gap-1 text-[11px] text-steel">
            <Clock className="h-3 w-3" strokeWidth={1.5} />
            {formatHoras(item.executadoSec)} hoje
          </span>
        )}
      </div>

      <DotsMenu
        items={[
          { label: "Editar", icon: Pencil, onSelect: onEditar },
          { label: "Não fazer hoje", icon: SkipForward, onSelect: onPular },
        ]}
      />
    </div>
  );
}

/**
 * Lista reordenável por arraste (pointer events — funciona com mouse e touch).
 * O arraste só inicia a partir do handle `[data-drag-handle]` de cada linha,
 * pra não conflitar com toque no checkbox/menu. Durante o arraste, a linha
 * segue o dedo/cursor e as demais deslizam para abrir espaço; ao soltar,
 * `onReordenar(deIndex, paraIndex)` é chamado com os índices finais.
 */
function ListaArrastavel<T extends { templateId: string }>({
  itens,
  onReordenar,
  children,
}: {
  itens: T[];
  onReordenar: (deIndex: number, paraIndex: number) => void;
  children: (item: T) => ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [arrastando, setArrastando] = useState<{ index: number; y: number; alturaLinha: number } | null>(null);
  const [alvo, setAlvo] = useState<number | null>(null);
  const inicioRef = useRef<{ pointerId: number; startY: number; index: number } | null>(null);

  function onPointerDown(e: React.PointerEvent, index: number) {
    const alvoEl = e.target as HTMLElement;
    if (!alvoEl.closest("[data-drag-handle]")) return;
    const linha = e.currentTarget.getBoundingClientRect();
    inicioRef.current = { pointerId: e.pointerId, startY: e.clientY, index };
    setArrastando({ index, y: 0, alturaLinha: linha.height });
    setAlvo(index);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const inicio = inicioRef.current;
    if (!inicio || !arrastando || !containerRef.current) return;
    const deltaY = e.clientY - inicio.startY;
    setArrastando({ ...arrastando, y: deltaY });

    const linhas = Array.from(containerRef.current.querySelectorAll("[data-linha-index]"));
    let novoAlvo = inicio.index;
    for (let i = 0; i < linhas.length; i++) {
      const rect = linhas[i].getBoundingClientRect();
      const meio = rect.top + rect.height / 2;
      if (e.clientY > meio) novoAlvo = i;
    }
    setAlvo(novoAlvo);
  }

  function finalizar() {
    if (inicioRef.current && alvo !== null && alvo !== inicioRef.current.index) {
      onReordenar(inicioRef.current.index, alvo);
    }
    inicioRef.current = null;
    setArrastando(null);
    setAlvo(null);
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      {itens.map((item, index) => {
        const estaArrastando = arrastando?.index === index;
        return (
          <div
            key={item.templateId}
            data-linha-index={index}
            onPointerDown={(e) => onPointerDown(e, index)}
            onPointerMove={onPointerMove}
            onPointerUp={finalizar}
            onPointerCancel={finalizar}
            className={cn(
              "transition-transform",
              estaArrastando && "relative z-10 shadow-lg"
            )}
            style={
              estaArrastando
                ? { transform: `translateY(${arrastando.y}px)`, transition: "none" }
                : alvo !== null && arrastando
                  ? {
                      transform:
                        index > arrastando.index && index <= alvo
                          ? `translateY(-${arrastando.alturaLinha + 8}px)`
                          : index < arrastando.index && index >= alvo
                            ? `translateY(${arrastando.alturaLinha + 8}px)`
                            : undefined,
                    }
                  : undefined
            }
          >
            {children(item)}
          </div>
        );
      })}
    </div>
  );
}
