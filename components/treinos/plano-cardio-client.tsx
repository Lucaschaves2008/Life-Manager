"use client";

import { useState, useTransition } from "react";
import { useAcao } from "@/lib/acao-cliente";
import {
  Bike,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Files,
  Footprints,
  Pencil,
  Plus,
  Trash2,
  Waves,
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
  createRun,
  createRunRoutine,
  createRunSession,
  deleteRun,
  deleteRunRoutine,
  deleteRunSession,
  duplicarSemanaSessoes,
  duplicateRunRoutine,
  moveRunSession,
  restoreRun,
  setRunRoutineDias,
  setSemanaAtual,
  updateRunRoutine,
  updateRunSession,
  type RunSessionInput,
} from "@/app/actions/treinos";
import type {
  ModalidadeCardio,
  PlanoCorridaView,
  SessaoCorridaView,
} from "@/lib/data/treinos-format";
import {
  DIAS_SEMANA_LABEL,
  MODALIDADE,
  campoDistancia,
  formatDiasSemana,
  formatDistanciaMod,
  numeroDigitado,
  paraKm,
} from "@/lib/data/treinos-format";
import { cn } from "@/lib/utils";

/** Ícone da modalidade — o mesmo par usado na aba e no card de treino de hoje. */
export const ICONE_MODALIDADE = {
  corrida: Footprints,
  natacao: Waves,
  ciclismo: Bike,
} as const;

/**
 * Planos de cardio (corrida, natação ou ciclismo). O componente é um só: a
 * modalidade entra por prop e decide rótulos, unidade e tipos de sessão. A
 * distância trafega em km no servidor e é convertida para a unidade da
 * modalidade só na borda do formulário (natação digita metros).
 */
export function PlanoCardioClient({
  planos,
  semana,
  modalidade,
  hoje,
}: {
  planos: PlanoCorridaView[];
  semana: number;
  modalidade: ModalidadeCardio;
  /** Data de hoje (yyyy-MM-dd) — usada ao marcar uma sessão como feita direto pela bolinha. */
  hoje: string;
}) {
  const cfg = MODALIDADE[modalidade];
  const Icone = ICONE_MODALIDADE[modalidade];
  const sessaoVazia: RunSessionInput = {
    nome: "",
    tipo: cfg.tipos[0],
    kmAlvo: paraKm(modalidade === "natacao" ? 1000 : 5, modalidade),
  };

  const [, executar] = useAcao();
  const [pending, startSalvar] = useTransition();

  const [sheetPlano, setSheetPlano] = useState(false);
  const [planoEditandoId, setPlanoEditandoId] = useState<string | null>(null);
  const [formPlano, setFormPlano] = useState<{ nome: string; foco: string; dias: number[] }>({
    nome: "",
    foco: "",
    dias: [],
  });

  const [sheetSessao, setSheetSessao] = useState<{ routineId: string; id: string | null } | null>(
    null
  );
  const [formSessao, setFormSessao] = useState<RunSessionInput>(sessaoVazia);
  // Campo de distância como texto: o usuário digita "1500" (m) ou "8,2" (km),
  // e só na hora de salvar isso vira km. Guardar o número já convertido faria
  // "1,5" reaparecer no lugar de "1500" a cada re-render da natação.
  const [distancia, setDistancia] = useState("");

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
        const novoId = await createRunRoutine(formPlano.nome, formPlano.foco, modalidade);
        if (formPlano.dias.length > 0) await setRunRoutineDias(novoId, formPlano.dias);
        toast.success("Plano criado");
      }
      setSheetPlano(false);
    });
  }

  function abrirSessao(routineId: string, s: SessaoCorridaView | null) {
    setSheetSessao({ routineId, id: s?.id ?? null });
    const base = s ? { nome: s.nome, tipo: s.tipo, kmAlvo: s.kmAlvo } : sessaoVazia;
    setFormSessao(base);
    setDistancia(campoDistancia(base.kmAlvo, modalidade));
  }

  // Cada semana é sua própria linha independente: editar sempre grava direto
  // na sessão (updateRunSession); criar sempre entra na semana ativa.
  function salvarSessao() {
    if (!sheetSessao) return;
    const kmAlvo = paraKm(numeroDigitado(distancia), modalidade);
    const payload: RunSessionInput = { ...formSessao, kmAlvo };
    startSalvar(async () => {
      if (sheetSessao.id) {
        await updateRunSession(sheetSessao.id, payload);
        toast.success("Sessão atualizada");
      } else {
        await createRunSession(sheetSessao.routineId, semana, payload);
        toast.success("Sessão adicionada");
      }
      setSheetSessao(null);
    });
  }

  function duplicarSemana(routineId: string, semanaOrigem: number) {
    executar(() => duplicarSemanaSessoes(routineId, semanaOrigem, semana), {
      sucesso: `Semana ${semana} criada a partir da semana ${semanaOrigem}`,
    });
  }

  function irParaSemana(n: number) {
    if (n === semana) return;
    executar(() => setSemanaAtual(n));
  }

  /** Bolinha: marca feito com o alvo da sessão. Já feita → desfaz (com "Desfazer"). */
  function alternarCumprida(s: SessaoCorridaView) {
    if (s.cumprida) {
      executar(async () => {
        const removida = await deleteRun(s.cumprida!.id);
        if (!removida) return;
        toast(`${s.nome} desmarcada`, {
          action: {
            label: "Desfazer",
            onClick: () =>
              restoreRun({
                data: removida.data,
                km: removida.km,
                segundos: removida.segundos,
                tipo: removida.tipo,
                modalidade: removida.modalidade,
                sensacao: removida.sensacao,
                notas: removida.notas,
                stravaLink: removida.stravaLink,
                runSessionId: removida.runSessionId,
                quantificar: removida.quantificar,
              }),
          },
        });
      });
      return;
    }
    executar(async () => {
      await createRun({
        data: hoje,
        km: s.kmAlvo,
        segundos: 0,
        tipo: s.tipo,
        modalidade,
        sensacao: 3,
        notas: null,
        runSessionId: s.id,
        quantificar: true,
      });
      toast.success(`${s.nome} marcada como feita`);
    });
  }

  if (planos.length === 0) {
    return (
      <>
        <EmptyState
          icon={Icone}
          title={`Nenhum plano de ${cfg.label.toLowerCase()} ainda`}
          description={`Crie um plano com sessões e progressão de ${cfg.unidade === "m" ? "metros" : "km"} por semana.`}
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
          modalidade={modalidade}
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
      <SeletorSemana semana={semana} modalidade={modalidade} planos={planos} onIr={irParaSemana} />

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
                <SemanaVaziaSessoes plano={plano} semana={semana} onDuplicar={duplicarSemana} />
              ) : (
                plano.sessoes.map((s, i) => (
                  <div
                    key={s.id}
                    className="group flex items-center gap-3 border-b border-stroke py-2.5 last:border-0"
                  >
                    <button
                      onClick={() => alternarCumprida(s)}
                      aria-label={s.cumprida ? "Desmarcar sessão feita" : "Marcar sessão como feita"}
                      aria-pressed={!!s.cumprida}
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                        s.cumprida
                          ? "border-transparent bg-mint text-[var(--color-bg)]"
                          : "border-stroke hover:border-mint"
                      )}
                    >
                      {s.cumprida && <Check className="h-3 w-3" strokeWidth={3} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13.5px] text-ice">{s.nome}</p>
                        <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10.5px] text-mist">
                          {s.tipo}
                        </span>
                      </div>
                      <p className="tabular text-[11.5px] text-steel">
                        alvo {formatDistanciaMod(s.kmAlvo, modalidade)}
                        {s.cumprida &&
                          ` · feito ${formatDistanciaMod(s.cumprida.km, modalidade)}`}
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
        modalidade={modalidade}
        form={formPlano}
        setForm={setFormPlano}
        onSalvar={salvarPlano}
        pending={pending}
      />

      <Sheet open={!!sheetSessao} onOpenChange={(v) => !v && setSheetSessao(null)}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>
            {sheetSessao?.id
              ? `Editar sessão · Semana ${semana}`
              : `Nova sessão · Semana ${semana}`}
          </SheetTitle>
          <div className="mt-6 flex flex-col gap-5">
            <div>
              <Label htmlFor="sess-nome">Nome</Label>
              <Input
                id="sess-nome"
                value={formSessao.nome}
                onChange={(e) => setFormSessao({ ...formSessao, nome: e.target.value })}
                placeholder={PLACEHOLDER_SESSAO[modalidade]}
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
                    {cfg.tipos.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sess-km">
                  Alvo ({cfg.unidade}){semana > 1 ? ` · sem. ${semana}` : ""}
                </Label>
                <Input
                  id="sess-km"
                  inputMode="decimal"
                  value={distancia}
                  onChange={(e) => setDistancia(e.target.value)}
                  className="tabular"
                  placeholder={cfg.placeholderDistancia}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={salvarSessao}
                disabled={!formSessao.nome.trim() || numeroDigitado(distancia) <= 0 || pending}
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

const PLACEHOLDER_SESSAO: Record<ModalidadeCardio, string> = {
  corrida: "Longão de domingo, Tiros na pista…",
  natacao: "Série de 10×100, Técnica de crawl…",
  ciclismo: "Pedal longo de sábado, Subidas…",
};

const PLACEHOLDER_PLANO: Record<ModalidadeCardio, { nome: string; foco: string }> = {
  corrida: { nome: "Base 5k", foco: "Resistência aeróbica" },
  natacao: { nome: "Base 1.500 m", foco: "Técnica e fôlego" },
  ciclismo: { nome: "Base 100 km", foco: "Resistência e cadência" },
};

function SheetPlano({
  aberto,
  onOpenChange,
  editando,
  modalidade,
  form,
  setForm,
  onSalvar,
  pending,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  editando: boolean;
  modalidade: ModalidadeCardio;
  form: { nome: string; foco: string; dias: number[] };
  setForm: (v: { nome: string; foco: string; dias: number[] }) => void;
  onSalvar: () => void;
  pending: boolean;
}) {
  const ph = PLACEHOLDER_PLANO[modalidade];
  function toggleDia(d: number) {
    setForm({
      ...form,
      dias: form.dias.includes(d) ? form.dias.filter((x) => x !== d) : [...form.dias, d],
    });
  }
  return (
    <Sheet open={aberto} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>
          {editando
            ? "Editar plano"
            : `Novo plano de ${MODALIDADE[modalidade].label.toLowerCase()}`}
        </SheetTitle>
        <div className="mt-6 flex flex-col gap-5">
          <div>
            <Label htmlFor="plano-nome">Nome</Label>
            <Input
              id="plano-nome"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder={ph.nome}
            />
          </div>
          <div>
            <Label htmlFor="plano-foco">Foco</Label>
            <Input
              id="plano-foco"
              value={form.foco}
              onChange={(e) => setForm({ ...form, foco: e.target.value })}
              placeholder={ph.foco}
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

/** Salto direto entre semanas — espelha o seletor de musculação. */
function SeletorSemana({
  semana,
  modalidade,
  planos,
  onIr,
}: {
  semana: number;
  modalidade: ModalidadeCardio;
  planos: PlanoCorridaView[];
  onIr: (n: number) => void;
}) {
  const maxComConteudo = Math.max(0, ...planos.flatMap((p) => p.semanasComConteudo));
  const maxPill = Math.max(1, maxComConteudo + 1, semana);
  const pills = Array.from({ length: maxPill }, (_, i) => i + 1);
  const temConteudo = (n: number) => planos.some((p) => p.semanasComConteudo.includes(n));

  return (
    <div className="rounded-[14px] border border-stroke bg-surface-2 px-3 py-2.5">
      <CardLabel>Periodização · {MODALIDADE[modalidade].label.toLowerCase()}</CardLabel>
      <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {pills.map((n) => (
          <button
            key={n}
            aria-label={`Semana ${n}`}
            aria-current={n === semana}
            onClick={() => onIr(n)}
            className={cn(
              "tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[12.5px] font-medium transition-colors",
              n === semana
                ? "border-transparent bg-mint text-[var(--color-bg)]"
                : temConteudo(n)
                  ? "border-stroke bg-surface text-ice hover:border-[var(--mint-border)]"
                  : "border-dashed border-stroke text-steel hover:text-ice"
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Semana ainda sem sessões neste plano: duplicar de outra semana ou começar do zero. */
function SemanaVaziaSessoes({
  plano,
  semana,
  onDuplicar,
}: {
  plano: PlanoCorridaView;
  semana: number;
  onDuplicar: (routineId: string, semanaOrigem: number) => void;
}) {
  const anteriores = plano.semanasComConteudo.filter((n) => n < semana).sort((a, b) => b - a);
  const origemSugerida = anteriores[0] ?? plano.semanasComConteudo[0];

  return (
    <div className="flex flex-col items-center gap-2.5 py-4 text-center">
      <p className="text-[13px] text-steel">
        {plano.semanasComConteudo.length === 0
          ? "Nenhuma sessão neste plano."
          : `A semana ${semana} ainda não tem sessões.`}
      </p>
      {origemSugerida != null && (
        <Button variant="outline" size="sm" onClick={() => onDuplicar(plano.id, origemSugerida)}>
          <Files className="h-3.5 w-3.5" strokeWidth={1.5} />
          Duplicar da semana {origemSugerida}
        </Button>
      )}
    </div>
  );
}
