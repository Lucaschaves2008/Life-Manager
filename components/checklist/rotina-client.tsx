"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, CalendarDays, Check, Clock, Flame, GlassWater, GripVertical, Pencil, Plus, SkipForward, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAcao } from "@/lib/acao-cliente";
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
  type ItemDiagnosticoUI,
  type RotinaTemplateInput,
} from "@/app/actions/rotinas";
import {
  atualizarVariavel,
  criarVariavel,
  excluirVariavel,
  moverVariavel,
  toggleVariavelCheckDia,
} from "@/app/actions/variaveis";
import { escolherOpcao, toggleRefeicaoCumprida } from "@/app/actions/dieta";
import type {
  RotinaOcorrenciaView,
  RotinaOpcao,
  RotinaPlanoView,
  RotinaTemplateView,
  TipoRotina,
} from "@/lib/data/rotinas";
import type { VariavelChecklistItem } from "@/lib/data/variaveis";
import type { AguaChecklistItem, RefeicaoChecklistItem } from "@/lib/data/dieta";
import type { CategoriaView } from "@/lib/data/estudos";
import type { SessaoCorridaOpcao } from "@/lib/data/treinos-format";
import { formatHoras } from "@/lib/data/estudos-format";
import { cn } from "@/lib/utils";

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

/**
 * Confirma o salvamento dizendo a VERDADE sobre a lista de hoje.
 *
 * O item pode ser gravado com sucesso e mesmo assim não entrar no checklist —
 * por estar em outro plano, ou por ter recorrência que não cai neste dia. Um
 * "Item adicionado ao checklist" nesses casos é indistinguível de um bug: o
 * usuário salva, a lista não muda, e a conclusão natural é que não funcionou.
 */
function avisarDoItem(diag: ItemDiagnosticoUI, editando: boolean) {
  if (diag.apareceHoje) {
    toast.success(editando ? "Item atualizado" : "Item adicionado ao checklist");
    return;
  }

  if (diag.motivo === "plano") {
    toast.warning(editando ? "Item atualizado — não aparece hoje" : "Item criado — não aparece hoje", {
      description: `Ele é do ${diag.planoNome ?? "outro plano"}, e hoje o checklist está no ${
        diag.planoDoDiaNome ?? "plano padrão"
      }. Troque o plano do dia para vê-lo, ou marque o item como "Comum".`,
      duration: 8000,
    });
    return;
  }

  if (diag.motivo === "recorrencia") {
    toast.warning(editando ? "Item atualizado — não cai hoje" : "Item criado — não cai hoje", {
      description: diag.proximaLabel
        ? `A repetição escolhida não inclui hoje. Próxima vez: ${diag.proximaLabel}.`
        : "A repetição escolhida não inclui hoje nem os próximos 12 meses.",
      duration: 8000,
    });
    return;
  }

  toast.success(editando ? "Item atualizado" : "Item adicionado ao checklist");
}

const TIPO_META: Record<TipoRotina, { label: string; emoji: string }> = {
  livre: { label: "Livre", emoji: "•" },
  estudo: { label: "Estudo", emoji: "📚" },
  treino: { label: "Treino", emoji: "💪" },
  corrida: { label: "Corrida", emoji: "🏃" },
};

const VARIAVEL_META = { label: "Variável", emoji: "🔥" };

const REFEICAO_EMOJI = "🍽️";

/**
 * Tipo de item exibido na lista — "rotina" (RotinaTemplate), "variavel"
 * (Variavel) ou "refeicao" (Meal da dieta ativa, espelhada do DietDayLog).
 * A água do dia (também espelhada do DietDayLog) não entra nessa união: é
 * renderizada à parte, sempre visível, fora da lista arrastável/vazia.
 */
type ItemChecklist =
  | (RotinaOcorrenciaView & { origem: "rotina"; itemId: string })
  | (VariavelChecklistItem & { origem: "variavel"; itemId: string })
  | (RefeicaoChecklistItem & { origem: "refeicao"; itemId: string });

const METAS = [
  { label: "Sem meta", min: null },
  { label: "25 min", min: 25 },
  { label: "45 min", min: 45 },
  { label: "1h", min: 60 },
  { label: "1h30", min: 90 },
  { label: "2h", min: 120 },
];

type TipoRecorrencia = "nunca" | "todoDia" | "diasSemana" | "intervalo";

/** "variavel" é um tipo de item do checklist à parte de TipoRotina — não vira RotinaTemplate. */
type TipoItemForm = TipoRotina | "variavel";

type FormState = {
  id: string | null;
  nome: string;
  horaInicio: string;
  horaFim: string;
  tipoRecorrencia: TipoRecorrencia;
  diasSemana: number[];
  dataFim: string;
  tipo: TipoItemForm;
  studyCategoryId: string;
  routineId: string;
  runSessionId: string;
  metaMinutos: number | null;
  planoId: string;
  medeStreak: boolean;
  medeContagem: boolean;
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
    medeStreak: true,
    medeContagem: true,
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
  variaveis,
  refeicoes,
  agua,
  dia,
}: {
  ocorrencias: RotinaOcorrenciaView[];
  templates: RotinaTemplateView[];
  categorias: CategoriaView[];
  rotinasTreino: RotinaOpcao[];
  sessoesCorrida: SessaoCorridaOpcao[];
  planos: RotinaPlanoView[];
  planoAtivoId: string | null;
  variaveis: VariavelChecklistItem[];
  refeicoes: RefeicaoChecklistItem[];
  agua: AguaChecklistItem;
  /** yyyy-MM-dd */
  dia: string;
}) {
  const [pending, executar] = useAcao();
  const [gerenciar, setGerenciar] = useState(false);
  const [gerenciarPlanos, setGerenciarPlanos] = useState(false);
  const [novoPlanoNome, setNovoPlanoNome] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [ordemOtimista, setOrdemOtimista] = useState(ocorrencias);
  const [variaveisOtimista, setVariaveisOtimista] = useState(variaveis);
  const [refeicoesOtimista, setRefeicoesOtimista] = useState(refeicoes);

  useEffect(() => {
    setOrdemOtimista(ocorrencias);
  }, [ocorrencias]);

  useEffect(() => {
    setVariaveisOtimista(variaveis);
  }, [variaveis]);

  useEffect(() => {
    setRefeicoesOtimista(refeicoes);
  }, [refeicoes]);

  const catPorId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

  // Lista unificada exibida: rotinas (arrastáveis entre si), variáveis (ordem
  // própria) e, por último, as refeições da dieta ativa. Refeições não são
  // arrastáveis: a ordem delas é a da dieta (Meal.ordem), editada em /dieta.
  const itens: ItemChecklist[] = useMemo(
    () => [
      ...ordemOtimista.map((oc) => ({ ...oc, origem: "rotina" as const, itemId: oc.templateId })),
      ...variaveisOtimista.map((v) => ({ ...v, origem: "variavel" as const, itemId: v.id })),
      ...refeicoesOtimista.map((r) => ({
        ...r,
        origem: "refeicao" as const,
        itemId: `refeicao:${r.id}`,
      })),
    ],
    [ordemOtimista, variaveisOtimista, refeicoesOtimista]
  );

  function toggle(templateId: string) {
    const virar = () =>
      setOrdemOtimista((atuais) =>
        atuais.map((oc) =>
          oc.templateId === templateId
            ? { ...oc, feito: !oc.feito, feitoAuto: false }
            : oc
        )
      );
    virar();
    executar(() => toggleRotinaCheckDia(templateId, dia), { aoFalhar: virar });
  }

  function toggleVariavel(variavelId: string) {
    const virar = () =>
      setVariaveisOtimista((atuais) =>
        atuais.map((v) => (v.id === variavelId ? { ...v, feito: !v.feito } : v))
      );
    virar();
    executar(() => toggleVariavelCheckDia(variavelId, dia), { aoFalhar: virar });
  }

  /**
   * Marca/desmarca a refeição. Sem opções cadastradas, é um toggle simples.
   * Com opções, marcar exige escolher qual foi comida (senão os macros do dia
   * não fecham) — quem chama abre o seletor; aqui só desmarcamos.
   */
  function toggleRefeicao(mealId: string) {
    const anterior = refeicoesOtimista;
    setRefeicoesOtimista((atuais) =>
      atuais.map((r) =>
        r.id === mealId ? { ...r, feito: !r.feito, escolhaId: r.feito ? null : r.escolhaId } : r
      )
    );
    executar(() => toggleRefeicaoCumprida(dia, mealId), {
      aoFalhar: () => setRefeicoesOtimista(anterior),
    });
  }

  /** Registra a opção comida — marca a refeição como cumprida junto (ver escolherOpcao). */
  function escolherOpcaoRefeicao(mealId: string, optionId: string) {
    const anterior = refeicoesOtimista;
    setRefeicoesOtimista((atuais) =>
      atuais.map((r) => (r.id === mealId ? { ...r, feito: true, escolhaId: optionId } : r))
    );
    executar(() => escolherOpcao(dia, mealId, optionId), {
      aoFalhar: () => setRefeicoesOtimista(anterior),
    });
  }

  function reordenar(deIndex: number, paraIndex: number) {
    if (deIndex === paraIndex) return;
    // Arraste só é permitido dentro do próprio grupo (rotinas ou variáveis).
    // Refeições ficam fora dos dois ranges, então nunca reordenam.
    const dentroDeRotinas = deIndex < ordemOtimista.length && paraIndex < ordemOtimista.length;
    const limiteVariaveis = ordemOtimista.length + variaveisOtimista.length;
    const dentroDeVariaveis =
      deIndex >= ordemOtimista.length &&
      deIndex < limiteVariaveis &&
      paraIndex >= ordemOtimista.length &&
      paraIndex < limiteVariaveis;

    if (dentroDeRotinas) {
      const anterior = ordemOtimista;
      const proxima = ordemOtimista.slice();
      const [item] = proxima.splice(deIndex, 1);
      proxima.splice(paraIndex, 0, item);
      setOrdemOtimista(proxima);
      executar(() => reordenarRotinaTemplates(proxima.map((o) => o.templateId)), {
        aoFalhar: () => setOrdemOtimista(anterior),
      });
      return;
    }
    if (dentroDeVariaveis) {
      const anterior = variaveisOtimista;
      const offset = ordemOtimista.length;
      const proxima = variaveisOtimista.slice();
      const [item] = proxima.splice(deIndex - offset, 1);
      proxima.splice(paraIndex - offset, 0, item);
      setVariaveisOtimista(proxima);
      const direcao = paraIndex > deIndex ? 1 : -1;
      executar(() => moverVariavel(item.id, direcao), {
        aoFalhar: () => setVariaveisOtimista(anterior),
      });
    }
  }

  function pular(templateId: string) {
    executar(() => pularRotinaHoje(templateId, dia), { sucesso: "Item pulado hoje" });
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
      medeStreak: true,
      medeContagem: true,
    });
  }

  function abrirEdicaoVariavel(v: VariavelChecklistItem) {
    setForm({
      ...formVazio(),
      id: v.id,
      nome: v.nome,
      tipo: "variavel",
      medeStreak: v.medeStreak,
      medeContagem: v.medeContagem,
    });
  }

  function salvar() {
    if (!form) return;
    const nome = form.nome.trim();
    if (!nome) return;

    if (form.tipo === "variavel") {
      const { id, medeStreak, medeContagem } = form;
      executar(
        async () => {
          const payload = { nome, medeStreak, medeContagem };
          if (id) await atualizarVariavel(id, payload);
          else await criarVariavel(payload);
          setForm(null);
        },
        { sucesso: id ? "Variável atualizada" : "Variável criada" }
      );
      return;
    }

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
    const id = form.id;
    // O toast de sucesso sai de avisarDoItem, que depende do diagnóstico
    // devolvido pela action — por isso não usa a opção `sucesso` do useAcao.
    executar(async () => {
      const diag = id
        ? await atualizarRotinaTemplate(id, payload)
        : await criarRotinaTemplate(payload);
      setForm(null);
      avisarDoItem(diag, Boolean(id));
    });
  }

  function excluirVariavelItem(id: string) {
    executar(() => excluirVariavel(id), { sucesso: "Variável removida" });
  }

  function excluir(id: string) {
    executar(() => excluirRotinaTemplate(id), { sucesso: "Item removido" });
  }

  function escolherPlano(planoId: string) {
    const alvo = planos.find((p) => p.id === planoId);
    executar(() => escolherRotinaPlanoDoDia(dia, planoId), {
      sucesso: alvo ? `Hoje está no ${alvo.nome}` : "Plano do dia atualizado",
    });
  }

  function criarPlano() {
    const nome = novoPlanoNome.trim();
    if (!nome) return;
    // Só o PRIMEIRO plano adota os itens soltos (ver criarRotinaPlano). Do
    // segundo em diante o plano nasce vazio — e escolhê-lo para hoje esvazia
    // o checklist, o que sem aviso parece que os itens sumiram.
    const nasceVazio = planos.length > 0;
    executar(async () => {
      await criarRotinaPlano(nome);
      setNovoPlanoNome("");
      if (nasceVazio) {
        toast.success(`${nome} criado — está vazio`, {
          description:
            'Planos não compartilham itens. Adicione itens a ele, ou marque um item como "Comum" para que apareça em todos os planos.',
          duration: 8000,
        });
      } else {
        toast.success("Plano criado");
      }
    });
  }

  function renomearPlano(id: string, nomeAtual: string) {
    const nome = window.prompt("Novo nome do plano", nomeAtual);
    if (!nome || !nome.trim() || nome === nomeAtual) return;
    executar(() => renomearRotinaPlano(id, nome), { sucesso: "Plano renomeado" });
  }

  function tornarPadrao(id: string) {
    const alvo = planos.find((p) => p.id === id);
    executar(() => definirRotinaPlanoPadrao(id), {
      sucesso: alvo ? `${alvo.nome} agora é o plano padrão` : "Plano padrão atualizado",
    });
  }

  function excluirPlano(id: string) {
    executar(() => excluirRotinaPlano(id), { sucesso: "Plano removido" });
  }

  const planoAtivo = planos.find((p) => p.id === planoAtivoId);

  // Diagnóstico do vazio: um checklist sem itens hoje quase nunca significa
  // "você não cadastrou nada". Quase sempre é plano do dia diferente ou
  // recorrência que não bate — e o empty state genérico escondia os dois.
  const ocultosPorPlano = useMemo(
    () => templates.filter((t) => t.planoId && t.planoId !== planoAtivoId),
    [templates, planoAtivoId]
  );
  const planoComMaisItens = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const t of ocultosPorPlano) {
      contagem.set(t.planoId!, (contagem.get(t.planoId!) ?? 0) + 1);
    }
    const [melhorId] = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    return planos.find((p) => p.id === melhorId) ?? null;
  }, [ocultosPorPlano, planos]);
  const ocultosPorRecorrencia = Math.max(
    0,
    templates.length - ocultosPorPlano.length - ordemOtimista.length
  );

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

      <div className="mt-4 flex flex-col gap-2">
        {itens.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={
              templates.length === 0
                ? "Nenhum item planejado para hoje"
                : ocultosPorPlano.length > 0
                  ? `Nenhum item do ${planoAtivo?.nome ?? "plano de hoje"} cai hoje`
                  : "Seus itens não se repetem hoje"
            }
            description={
              templates.length === 0
                ? "Adicione um treino, estudo, tarefa ou variável e organize seu dia."
                : [
                    ocultosPorPlano.length > 0 &&
                      `${ocultosPorPlano.length} ${
                        ocultosPorPlano.length === 1 ? "item está" : "itens estão"
                      } em outro plano${planoComMaisItens ? ` (${planoComMaisItens.nome})` : ""}.`,
                    ocultosPorRecorrencia > 0 &&
                      `${ocultosPorRecorrencia} ${
                        ocultosPorRecorrencia === 1 ? "item não cai" : "itens não caem"
                      } neste dia da semana.`,
                  ]
                    .filter(Boolean)
                    .join(" ")
            }
            action={
              templates.length === 0 ? undefined : (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {planoComMaisItens && (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={pending}
                      onClick={() => escolherPlano(planoComMaisItens.id)}
                    >
                      Usar {planoComMaisItens.nome} hoje
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setGerenciar(true)}>
                    Ver todos os {templates.length} itens
                  </Button>
                </div>
              )
            }
            className="py-12"
          />
        ) : (
          <ListaArrastavel itens={itens} onReordenar={reordenar}>
            {(item) => {
              if (item.origem === "rotina") {
                return (
                  <ItemLinha
                    item={item}
                    categoria={item.studyCategoryId ? catPorId.get(item.studyCategoryId) : undefined}
                    onToggle={() => toggle(item.templateId)}
                    onEditar={() => {
                      const t = templates.find((tt) => tt.id === item.templateId);
                      if (t) abrirEdicao(t);
                    }}
                    onPular={() => pular(item.templateId)}
                  />
                );
              }
              if (item.origem === "variavel") {
                return (
                  <ItemLinhaVariavel
                    item={item}
                    onToggle={() => toggleVariavel(item.id)}
                    onEditar={() => abrirEdicaoVariavel(item)}
                    onExcluir={() => excluirVariavelItem(item.id)}
                  />
                );
              }
              return (
                <ItemLinhaRefeicao
                  item={item}
                  onToggle={() => toggleRefeicao(item.id)}
                  onEscolher={(optionId) => escolherOpcaoRefeicao(item.id, optionId)}
                />
              );
            }}
          </ListaArrastavel>
        )}
        <ItemLinhaAgua item={agua} />
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
                      onClick={() => executar(() => moverRotinaTemplate(t.id, -1))}
                      className="rounded-full p-1.5 text-steel transition-colors hover:bg-surface hover:text-ice disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      aria-label="Descer"
                      disabled={i === templates.length - 1}
                      onClick={() => executar(() => moverRotinaTemplate(t.id, 1))}
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
                  {!form.id || form.tipo === "variavel" ? (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, tipo: "variavel" })}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors",
                        form.tipo === "variavel"
                          ? "border-[rgba(13,110,253,.4)] bg-mint-soft text-mint"
                          : "border-stroke text-mist hover:border-[rgba(143,169,205,.22)]"
                      )}
                    >
                      <span>{VARIAVEL_META.emoji}</span>
                      {VARIAVEL_META.label}
                    </button>
                  ) : null}
                </div>
                {form.tipo === "variavel" && (
                  <p className="mt-2 text-[12px] text-steel">
                    Uma variável é uma métrica pessoal (ex.: &quot;Corrida&quot;, &quot;Sem
                    pornografia&quot;) que fica marcável todo dia e pode ser usada como progresso
                    em Metas e Desafios.
                  </p>
                )}
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
                  placeholder="Ex.: Estudar inglês, Treino de peito, Sem pornografia…"
                />
              </div>

              {/* Tipo de progresso (só tipo variável) */}
              {form.tipo === "variavel" && (
                <div>
                  <Label>Tipo de progresso</Label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, medeStreak: !form.medeStreak })}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors",
                        form.medeStreak
                          ? "border-[rgba(13,110,253,.4)] bg-mint-soft text-mint"
                          : "border-stroke text-mist hover:border-[rgba(143,169,205,.22)]"
                      )}
                    >
                      <Flame className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Streak (dias seguidos)
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, medeContagem: !form.medeContagem })}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors",
                        form.medeContagem
                          ? "border-[rgba(13,110,253,.4)] bg-mint-soft text-mint"
                          : "border-stroke text-mist hover:border-[rgba(143,169,205,.22)]"
                      )}
                    >
                      Contagem no período
                    </button>
                  </div>
                  {!form.medeStreak && !form.medeContagem && (
                    <p className="mt-2 text-[12px] text-amber">
                      Escolha ao menos um tipo de progresso.
                    </p>
                  )}
                </div>
              )}

              {/* Campos específicos de rotina (não se aplicam a variável) */}
              {form.tipo !== "variavel" && (
                <>
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
                </>
              )}

              <Button
                variant="primary"
                onClick={salvar}
                disabled={pending || (form.tipo === "variavel" && !form.medeStreak && !form.medeContagem)}
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

function ItemLinhaVariavel({
  item,
  onToggle,
  onEditar,
  onExcluir,
}: {
  item: VariavelChecklistItem;
  onToggle: () => void;
  onEditar: () => void;
  onExcluir: () => void;
}) {
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

      <span className="w-11 shrink-0 text-center text-[12px] text-steel/60">–</span>

      <span className="text-[15px] leading-none">{item.emoji}</span>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[13.5px]", item.feito ? "text-ice" : "text-mist")}>
          {item.nome}
        </p>
        {item.streakAtual !== null && item.streakAtual > 0 && (
          <span className="tabular mt-1 flex items-center gap-1 text-[11px] text-amber">
            <Flame className="h-3 w-3" strokeWidth={1.5} />
            {item.streakAtual} {item.streakAtual === 1 ? "dia" : "dias"}
          </span>
        )}
      </div>

      <DotsMenu
        items={[
          { label: "Editar", icon: Pencil, onSelect: onEditar },
          { label: "Excluir", icon: Trash2, destructive: true, onSelect: onExcluir },
        ]}
      />
    </div>
  );
}

/**
 * Refeição da dieta ativa como linha do checklist.
 *
 * Escreve no mesmo DietDayLog da tela de Dieta, então marcar aqui já conta na
 * métrica "refeicoes_cumpridas" de metas e desafios. Quando a refeição tem
 * opções cadastradas (Opção A/B/C), marcar abre o seletor: sem registrar QUAL
 * opção foi comida os macros do dia não fecham (ver diaDaDieta). Sem opções,
 * o clique é um toggle direto.
 */
function ItemLinhaRefeicao({
  item,
  onToggle,
  onEscolher,
}: {
  item: RefeicaoChecklistItem;
  onToggle: () => void;
  onEscolher: (optionId: string) => void;
}) {
  const [escolhendo, setEscolhendo] = useState(false);
  const temOpcoes = item.opcoes.length > 0;
  // Só vale oferecer escolha quando há de fato o que escolher.
  const temEscolha = item.opcoes.length > 1;
  const opcaoEscolhida = item.opcoes.find((o) => o.id === item.escolhaId);

  function aoClicarCheck() {
    // Desmarcar é sempre direto.
    if (item.feito) {
      onToggle();
      return;
    }
    // Opção única: não há o que escolher — registra direto (fecha os macros
    // do dia sem um clique extra em um seletor de um item só).
    if (item.opcoes.length === 1) {
      onEscolher(item.opcoes[0].id);
      return;
    }
    // Duas ou mais: precisa saber QUAL foi comida.
    if (temOpcoes) {
      setEscolhendo((v) => !v);
      return;
    }
    onToggle();
  }

  return (
    <div
      className={cn(
        "rounded-[14px] border transition-colors",
        item.feito
          ? "border-mint/30 bg-mint-soft"
          : "border-stroke bg-surface-2 hover:border-[rgba(143,169,205,.25)]"
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Espaçador no lugar do handle: a ordem das refeições é a da dieta,
            então a linha não arrasta — mas alinha com rotinas e variáveis. */}
        <span className="-ml-1 h-8 w-5 shrink-0" aria-hidden="true"></span>

        <button
          type="button"
          onClick={aoClicarCheck}
          aria-label={item.feito ? "Desmarcar refeição" : "Marcar refeição como feita"}
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

        {item.horario ? (
          <span className="tabular w-11 shrink-0 text-[12.5px] text-steel">{item.horario}</span>
        ) : (
          <span className="w-11 shrink-0 text-center text-[12px] text-steel/60">–</span>
        )}

        <span className="text-[15px] leading-none">{REFEICAO_EMOJI}</span>

        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-[13.5px]", item.feito ? "text-ice" : "text-mist")}>
            {item.nome}
          </p>
          {opcaoEscolhida && (
            <span className="mt-1 block truncate text-[11px] text-steel">
              {opcaoEscolhida.nome}
            </span>
          )}
        </div>

        {temEscolha && (
          <button
            type="button"
            onClick={() => setEscolhendo((v) => !v)}
            className="shrink-0 text-[11px] text-steel transition-colors hover:text-ice"
          >
            {item.feito ? "Trocar" : "Opções"}
          </button>
        )}
      </div>

      {escolhendo && temEscolha && (
        <div className="flex flex-wrap gap-2 border-t border-stroke px-4 py-2.5">
          {item.opcoes.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onEscolher(o.id);
                setEscolhendo(false);
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] transition-colors",
                o.id === item.escolhaId
                  ? "border-mint bg-mint-soft text-ice"
                  : "border-stroke text-mist hover:border-mint/60 hover:text-ice"
              )}
            >
              {o.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Água do dia como linha do checklist — sem toggle próprio: o check some
 * quando `aguaMl >= metaAguaMl`, o mesmo cálculo de AguaClient em /dieta,
 * onde os copos ficam. Clicar na linha leva pra lá em vez de marcar aqui,
 * já que marcar precisa saber QUANTOS copos foram bebidos, não só sim/não.
 */
function ItemLinhaAgua({ item }: { item: AguaChecklistItem }) {
  const pct = item.metaAguaMl > 0 ? Math.min(100, (item.aguaMl / item.metaAguaMl) * 100) : 0;

  return (
    <Link
      href="/dieta"
      className={cn(
        "flex items-center gap-3 rounded-[14px] border px-4 py-3 transition-colors",
        item.feito
          ? "border-mint/30 bg-mint-soft"
          : "border-stroke bg-surface-2 hover:border-[rgba(143,169,205,.25)]"
      )}
    >
      <span className="-ml-1 h-8 w-5 shrink-0" aria-hidden="true"></span>

      <span
        aria-hidden="true"
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          item.feito ? "border-mint bg-mint" : "border-stroke"
        )}
      >
        {item.feito && (
          <svg viewBox="0 0 12 12" className="h-3 w-3 fill-none stroke-[var(--color-bg)]">
            <path d="M2 6l2.5 2.5L10 3" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>

      <span className="w-11 shrink-0 text-center text-[12px] text-steel/60">–</span>

      <GlassWater className="h-[15px] w-[15px] shrink-0 text-mist" strokeWidth={1.5} />

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[13.5px]", item.feito ? "text-ice" : "text-mist")}>
          Beber água
          {item.feito && <span className="ml-2 text-[11px] text-mint">auto</span>}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1 w-24 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-mint transition-all duration-500"
              style={{ width: `${Math.max(2, pct)}%` }}
            />
          </div>
          <span className="tabular text-[11px] text-steel">
            {(item.aguaMl / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} de{" "}
            {(item.metaAguaMl / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L
          </span>
        </div>
      </div>
    </Link>
  );
}

/**
 * Lista reordenável por arraste (pointer events — funciona com mouse e touch).
 * O arraste só inicia a partir do handle `[data-drag-handle]` de cada linha,
 * pra não conflitar com toque no checkbox/menu. Durante o arraste, a linha
 * segue o dedo/cursor e as demais deslizam para abrir espaço; ao soltar,
 * `onReordenar(deIndex, paraIndex)` é chamado com os índices finais.
 */
function ListaArrastavel<T extends { itemId: string }>({
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
            key={item.itemId}
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
