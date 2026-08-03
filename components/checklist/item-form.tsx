"use client";

import { useState } from "react";
import { Flame, Plus, X } from "lucide-react";
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
import {
  atualizarRotinaTemplate,
  criarRotinaTemplate,
  type ItemDiagnosticoUI,
  type RotinaTemplateInput,
} from "@/app/actions/rotinas";
import { atualizarVariavel, criarVariavel } from "@/app/actions/variaveis";
import type {
  RotinaOpcao,
  RotinaPlanoView,
  RotinaTemplateView,
} from "@/lib/data/rotinas";
// Valores vêm do módulo puro: rotinas.ts é server-only ("use cache"/cache-tags)
// e importá-lo aqui arrastaria o grafo server para o bundle do cliente.
import {
  TIPO_CARDIO,
  ehTipoCardio,
  type LocalItem,
  type TipoCardio,
  type TipoRotina,
} from "@/lib/data/rotinas-constantes";
import type { VariavelChecklistItem } from "@/lib/data/variaveis";
import type { CategoriaView } from "@/lib/data/estudos";
import type { SessaoCorridaOpcao } from "@/lib/data/treinos-format";
import { cn } from "@/lib/utils";

/**
 * Formulário único de item — usado tanto pela lista do dia quanto pelo bloco
 * de Hábitos. A diferença entre os dois é só `local`: em Hábitos não há
 * horário nem plano (o item é "todo dia, sempre igual"), o resto é idêntico.
 * Ter um formulário só é o que garante que escolher "Corrida" ou "Refeição"
 * funciona igual nos dois lugares, sem duas telas divergindo com o tempo.
 */

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

export const TIPO_META: Record<TipoRotina, { label: string; emoji: string }> = {
  livre: { label: "Livre", emoji: "•" },
  estudo: { label: "Estudo", emoji: "📚" },
  treino: { label: "Treino", emoji: "💪" },
  corrida: { label: "Corrida", emoji: "🏃" },
  natacao: { label: "Natação", emoji: "🏊" },
  ciclismo: { label: "Ciclismo", emoji: "🚴" },
  refeicao: { label: "Refeição", emoji: "🍽️" },
};

export const VARIAVEL_META = { label: "Variável", emoji: "🔥" };

const METAS = [
  { label: "Sem meta", min: null },
  { label: "25 min", min: 25 },
  { label: "45 min", min: 45 },
  { label: "1h", min: 60 },
  { label: "1h30", min: 90 },
  { label: "2h", min: 120 },
];

export type TipoRecorrencia = "nunca" | "todoDia" | "diasSemana" | "intervalo";

/** "variavel" é um tipo de item à parte de TipoRotina — não vira RotinaTemplate. */
export type TipoItemForm = TipoRotina | "variavel";

export type FormState = {
  id: string | null;
  nome: string;
  nota: string;
  local: LocalItem;
  horaInicio: string;
  horaFim: string;
  tipoRecorrencia: TipoRecorrencia;
  diasSemana: number[];
  dataFim: string;
  tipo: TipoItemForm;
  studyCategoryId: string;
  routineId: string;
  runSessionId: string;
  mealId: string;
  metaMinutos: number | null;
  planoId: string;
  opcoes: string[];
  medeStreak: boolean;
  medeContagem: boolean;
};

export function formVazio(local: LocalItem, planoId = ""): FormState {
  return {
    id: null,
    nome: "",
    nota: "",
    local,
    horaInicio: "",
    horaFim: "",
    // Item de Hábitos é diário por natureza; na lista do dia o padrão continua
    // sendo "não se repete" (tarefa pontual daquele dia).
    tipoRecorrencia: local === "habitos" ? "todoDia" : "nunca",
    diasSemana: [],
    dataFim: "",
    tipo: local === "habitos" ? "variavel" : "livre",
    studyCategoryId: "",
    routineId: "",
    runSessionId: "",
    mealId: "",
    metaMinutos: null,
    planoId: local === "habitos" ? "" : planoId,
    opcoes: [],
    medeStreak: true,
    medeContagem: true,
  };
}

export function rrulePara(rrule: string | null): {
  tipo: TipoRecorrencia;
  diasSemana: number[];
  dataFim: string;
} {
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

/** Preenche o form a partir de um template salvo (edição). */
export function formDoTemplate(t: RotinaTemplateView): FormState {
  const { tipo, diasSemana, dataFim } = rrulePara(t.rrule);
  return {
    ...formVazio(t.local),
    id: t.id,
    nome: t.nome,
    nota: t.nota ?? "",
    local: t.local,
    horaInicio: t.horaInicio ?? "",
    horaFim: t.horaFim ?? "",
    tipoRecorrencia: tipo,
    diasSemana,
    dataFim,
    tipo: t.tipo,
    studyCategoryId: t.studyCategoryId ?? "",
    routineId: t.routineId ?? "",
    runSessionId: t.runSessionId ?? "",
    mealId: t.mealId ?? "",
    metaMinutos: t.metaMinutos,
    planoId: t.planoId ?? "",
    opcoes: t.opcoes.map((o) => o.nome),
  };
}

/** Preenche o form a partir de uma variável salva (edição). */
export function formDaVariavel(v: VariavelChecklistItem): FormState {
  return {
    ...formVazio(v.local),
    id: v.id,
    nome: v.nome,
    nota: v.nota ?? "",
    tipo: "variavel",
    medeStreak: v.medeStreak,
    medeContagem: v.medeContagem,
  };
}

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

export type OpcoesDeVinculo = {
  categorias: CategoriaView[];
  rotinasTreino: RotinaOpcao[];
  sessoesCorrida: SessaoCorridaOpcao[];
  refeicoesCadastradas: RotinaOpcao[];
  planos: RotinaPlanoView[];
};

export function ItemFormSheet({
  form,
  setForm,
  dia,
  categorias,
  rotinasTreino,
  sessoesCorrida,
  refeicoesCadastradas,
  planos,
}: OpcoesDeVinculo & {
  form: FormState | null;
  setForm: (f: FormState | null) => void;
  /** yyyy-MM-dd — dia-âncora da recorrência */
  dia: string;
}) {
  const [pending, executar] = useAcao();
  const [novaOpcao, setNovaOpcao] = useState("");
  const emHabitos = form?.local === "habitos";

  function atualizar(patch: Partial<FormState>) {
    if (form) setForm({ ...form, ...patch });
  }

  function adicionarOpcao() {
    const nome = novaOpcao.trim();
    if (!form || !nome || form.opcoes.includes(nome)) return;
    atualizar({ opcoes: [...form.opcoes, nome] });
    setNovaOpcao("");
  }

  function salvar() {
    if (!form) return;
    const nome = form.nome.trim();
    if (!nome) return;

    if (form.tipo === "variavel") {
      const { id, nota, local, medeStreak, medeContagem } = form;
      executar(
        async () => {
          const payload = { nome, nota, local, medeStreak, medeContagem };
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
      nota: form.nota,
      local: form.local,
      // Item de Hábitos não tem horário nem plano: ele é "todo dia, sempre
      // igual". Gravar hora aqui o faria reaparecer na agenda do dia.
      horaInicio: emHabitos ? null : form.horaInicio || null,
      horaFim: emHabitos ? null : form.horaFim || null,
      dataInicio: dia,
      tipoRecorrencia: form.tipoRecorrencia,
      diasSemana: form.tipoRecorrencia === "diasSemana" ? form.diasSemana : undefined,
      dataFim: form.dataFim || null,
      tipo: form.tipo,
      studyCategoryId: form.tipo === "estudo" ? form.studyCategoryId || null : null,
      routineId: form.tipo === "treino" ? form.routineId || null : null,
      runSessionId: ehTipoCardio(form.tipo) ? form.runSessionId || null : null,
      mealId: form.tipo === "refeicao" ? form.mealId || null : null,
      metaMinutos:
        form.tipo === "estudo" || ehTipoCardio(form.tipo) ? form.metaMinutos : null,
      planoId: emHabitos ? null : form.planoId || null,
      opcoes: form.tipo === "refeicao" ? [] : form.opcoes,
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

  const titulo = form?.id
    ? emHabitos
      ? "Editar hábito"
      : "Editar item"
    : emHabitos
      ? "Novo hábito"
      : "Novo item do checklist";

  // Variável e item de rotina moram em TABELAS diferentes: trocar entre eles
  // depois de salvo mandaria o update para o id errado ("item não encontrado").
  // Na edição, então, só se troca de tipo dentro do próprio grupo.
  const podeTrocarTipo = !form?.id;
  const aceitaOpcoes = form && form.tipo !== "variavel" && form.tipo !== "refeicao";
  // Narrowing feito uma vez aqui: dentro de callbacks do JSX o TypeScript perde
  // o estreitamento de `form.tipo` (acesso a propriedade em closure).
  const tipoCardio: TipoCardio | null =
    form && ehTipoCardio(form.tipo) ? form.tipo : null;

  return (
    <Sheet open={form !== null} onOpenChange={(v) => !v && setForm(null)}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>{titulo}</SheetTitle>
        {form && (
          <div className="mt-6 flex flex-col gap-5">
            {/* Tipo */}
            <div>
              <Label>Tipo</Label>
              <div className="flex flex-wrap gap-2">
                <ChipTipo
                  ativo={form.tipo === "variavel"}
                  emoji={VARIAVEL_META.emoji}
                  label={VARIAVEL_META.label}
                  desabilitado={!podeTrocarTipo}
                  onClick={() => atualizar({ tipo: "variavel" })}
                />
                {(Object.keys(TIPO_META) as TipoRotina[]).map((t) => (
                  <ChipTipo
                    key={t}
                    ativo={form.tipo === t}
                    emoji={TIPO_META[t].emoji}
                    label={TIPO_META[t].label}
                    desabilitado={!podeTrocarTipo && form.tipo === "variavel"}
                    onClick={() => atualizar({ tipo: t })}
                  />
                ))}
              </div>
              {form.tipo === "variavel" && (
                <p className="mt-2 text-[12px] text-steel">
                  Uma variável é uma métrica pessoal (ex.: &quot;Sem pornografia&quot;, &quot;Leitura&quot;)
                  marcável todo dia, que pode virar progresso em Metas e Desafios.
                </p>
              )}
            </div>

            {/* Onde aparece — a mesma chave que tira um item sem horário do
                meio da agenda do dia e o põe entre os hábitos. */}
            <div>
              <Label>Onde aparece</Label>
              <div className="flex flex-wrap gap-2">
                <ChipTipo
                  ativo={form.local === "checklist"}
                  emoji="🗓️"
                  label="Checklist do dia"
                  onClick={() => atualizar({ local: "checklist" })}
                />
                <ChipTipo
                  ativo={form.local === "habitos"}
                  emoji="♾️"
                  label="Hábitos"
                  onClick={() =>
                    atualizar({
                      local: "habitos",
                      // Hábito não tem hora nem plano: some da agenda do dia.
                      horaInicio: "",
                      horaFim: "",
                      planoId: "",
                      tipoRecorrencia:
                        form.tipoRecorrencia === "nunca" ? "todoDia" : form.tipoRecorrencia,
                    })
                  }
                />
              </div>
              <p className="mt-2 text-[12px] text-steel">
                {emHabitos
                  ? "Sem horário, todo dia igual — fica no bloco de Hábitos, fora da agenda."
                  : "Entra na lista de hoje, na ordem do horário."}
              </p>
            </div>

            {/* Nome */}
            <div>
              <Label htmlFor="item-nome">Nome</Label>
              <Input
                id="item-nome"
                autoFocus
                value={form.nome}
                onChange={(e) => atualizar({ nome: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && salvar()}
                placeholder="Ex.: Estudar inglês, Treino de peito, Sem pornografia…"
              />
            </div>

            {/* Descrição / porquê */}
            <div>
              <Label htmlFor="item-nota">
                {emHabitos ? "Por que esse hábito (opcional)" : "Descrição (opcional)"}
              </Label>
              <textarea
                id="item-nota"
                value={form.nota}
                onChange={(e) => atualizar({ nota: e.target.value })}
                rows={2}
                placeholder={
                  emHabitos ? "O motivo de estar cultivando esse hábito" : "Uma nota sobre o item"
                }
                className="w-full rounded-[10px] border border-stroke bg-surface px-3 py-2 text-[13px] text-ice outline-none focus:border-mint/60"
              />
            </div>

            {/* Tipo de progresso (só variável) */}
            {form.tipo === "variavel" && (
              <div>
                <Label>Tipo de progresso</Label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => atualizar({ medeStreak: !form.medeStreak })}
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
                    onClick={() => atualizar({ medeContagem: !form.medeContagem })}
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
                  <p className="mt-2 text-[12px] text-amber">Escolha ao menos um tipo de progresso.</p>
                )}
              </div>
            )}

            {/* Campos específicos de rotina (não se aplicam a variável) */}
            {form.tipo !== "variavel" && (
              <>
                {form.tipo === "estudo" && (
                  <SeletorVinculo
                    label="Categoria de estudo"
                    vazio="Cadastre categorias na aba de estudos para conectar o cronômetro."
                    placeholder="Escolha a categoria"
                    valor={form.studyCategoryId}
                    onChange={(v) => atualizar({ studyCategoryId: v })}
                    opcoes={categorias.map((c) => ({ id: c.id, nome: `${c.emoji} ${c.nome}` }))}
                  />
                )}

                {form.tipo === "treino" && (
                  <SeletorVinculo
                    label="Rotina de treino"
                    vazio="Cadastre rotinas em Treinos para vincular."
                    placeholder="Escolha a rotina"
                    valor={form.routineId}
                    onChange={(v) => atualizar({ routineId: v })}
                    opcoes={rotinasTreino.map((r) => ({
                      id: r.id,
                      nome: r.foco ? `${r.nome} · ${r.foco}` : r.nome,
                    }))}
                  />
                )}

                {/* Cardio: só as sessões da MODALIDADE escolhida entram no
                    seletor — vincular um item de natação a um longão de corrida
                    faria o auto-check disparar no dia errado. */}
                {tipoCardio && (
                  <SeletorVinculo
                    label={`Sessão de ${TIPO_META[tipoCardio].label.toLowerCase()}`}
                    vazio={`Crie um plano de ${TIPO_META[tipoCardio].label.toLowerCase()} em Treinos para vincular uma sessão.`}
                    placeholder="Escolha a sessão"
                    valor={form.runSessionId}
                    onChange={(v) => atualizar({ runSessionId: v })}
                    opcoes={sessoesCorrida
                      .filter((s) => s.modalidade === TIPO_CARDIO[tipoCardio])
                      .map((s) => ({
                        id: s.id,
                        nome: `${s.nome} · ${s.tipo} (${s.planoNome})`,
                      }))}
                    ajuda="Ao registrar essa sessão em Treinos, o item marca sozinho no dia."
                  />
                )}

                {form.tipo === "refeicao" && (
                  <SeletorVinculo
                    label="Refeição"
                    vazio="Cadastre as refeições da sua dieta em Dieta para escolher aqui."
                    placeholder="Escolha a refeição"
                    valor={form.mealId}
                    onChange={(v) =>
                      atualizar({
                        mealId: v,
                        // O nome do item segue o da refeição, sem digitar de novo.
                        nome: form.nome.trim() || refeicoesCadastradas.find((r) => r.id === v)?.nome || "",
                      })
                    }
                    opcoes={refeicoesCadastradas.map((r) => ({
                      id: r.id,
                      nome: r.foco ? `${r.nome} · ${r.foco}` : r.nome,
                    }))}
                    ajuda="Marcar aqui conta na mesma métrica de Dieta — vale para metas como “30 refeições no mês”."
                  />
                )}

                {(form.tipo === "estudo" || ehTipoCardio(form.tipo)) && (
                  <div>
                    <Label>Meta de tempo</Label>
                    <div className="flex flex-wrap gap-2">
                      {METAS.map((m) => (
                        <button
                          key={m.label}
                          type="button"
                          onClick={() => atualizar({ metaMinutos: m.min })}
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

                {/* Alternativas: "hoje faço corrida OU musculação" */}
                {aceitaOpcoes && (
                  <div>
                    <Label>Alternativas (opcional)</Label>
                    <p className="-mt-1 mb-2 text-[12px] text-steel">
                      Cadastre duas ou mais e, ao marcar o item, você escolhe qual fez. Continua
                      contando como um item só nas metas.
                    </p>
                    {form.opcoes.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {form.opcoes.map((o) => (
                          <span
                            key={o}
                            className="flex items-center gap-1.5 rounded-full border border-stroke bg-surface-2 py-1 pl-3 pr-1.5 text-[12.5px] text-ice"
                          >
                            {o}
                            <button
                              type="button"
                              aria-label={`Remover ${o}`}
                              onClick={() =>
                                atualizar({ opcoes: form.opcoes.filter((x) => x !== o) })
                              }
                              className="rounded-full p-0.5 text-steel transition-colors hover:bg-surface hover:text-ice"
                            >
                              <X className="h-3 w-3" strokeWidth={2} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Input
                        value={novaOpcao}
                        onChange={(e) => setNovaOpcao(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            adicionarOpcao();
                          }
                        }}
                        placeholder="Ex.: Corrida, Musculação, Caminhada…"
                      />
                      <Button variant="outline" onClick={adicionarOpcao} disabled={!novaOpcao.trim()}>
                        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                        Add
                      </Button>
                    </div>
                    {form.opcoes.length === 1 && (
                      <p className="mt-2 text-[12px] text-amber">
                        Com uma alternativa só não há o que escolher — adicione outra ou remova esta.
                      </p>
                    )}
                  </div>
                )}

                {/* Horário — só na lista do dia */}
                {!emHabitos && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="item-ini">Início (opcional)</Label>
                      <Input
                        id="item-ini"
                        type="time"
                        value={form.horaInicio}
                        onChange={(e) => atualizar({ horaInicio: e.target.value })}
                        className="tabular"
                      />
                    </div>
                    <div>
                      <Label htmlFor="item-fim">Fim (opcional)</Label>
                      <Input
                        id="item-fim"
                        type="time"
                        value={form.horaFim}
                        onChange={(e) => atualizar({ horaFim: e.target.value })}
                        className="tabular"
                      />
                    </div>
                  </div>
                )}

                {/* Repetição */}
                <div>
                  <Label>Repetição</Label>
                  <Select
                    value={form.tipoRecorrencia}
                    onValueChange={(v) => atualizar({ tipoRecorrencia: v as TipoRecorrencia })}
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
                            atualizar({
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

                  {form.tipoRecorrencia !== "nunca" && (
                    <div className="mt-3">
                      <Label htmlFor="item-data-fim">Até (opcional)</Label>
                      <Input
                        id="item-data-fim"
                        type="date"
                        value={form.dataFim}
                        onChange={(e) => atualizar({ dataFim: e.target.value })}
                        className="w-44"
                      />
                    </div>
                  )}
                </div>

                {/* Plano — só na lista do dia */}
                {!emHabitos && planos.length > 0 && (
                  <div>
                    <Label>Plano</Label>
                    <Select
                      value={form.planoId || "comum"}
                      onValueChange={(v) => atualizar({ planoId: v === "comum" ? "" : v })}
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
              disabled={
                pending ||
                !form.nome.trim() ||
                (form.tipo === "variavel" && !form.medeStreak && !form.medeContagem) ||
                form.opcoes.length === 1
              }
              className="mt-1 h-11 text-[14px]"
            >
              {form.id ? "Salvar" : emHabitos ? "Adicionar aos hábitos" : "Adicionar ao checklist"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ChipTipo({
  ativo,
  emoji,
  label,
  desabilitado,
  onClick,
}: {
  ativo: boolean;
  emoji: string;
  label: string;
  desabilitado?: boolean;
  onClick: () => void;
}) {
  if (desabilitado && !ativo) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors",
        ativo
          ? "border-[rgba(13,110,253,.4)] bg-mint-soft text-mint"
          : "border-stroke text-mist hover:border-[rgba(143,169,205,.22)]",
        desabilitado && "cursor-default opacity-70"
      )}
    >
      <span>{emoji}</span>
      {label}
    </button>
  );
}

function SeletorVinculo({
  label,
  vazio,
  placeholder,
  valor,
  onChange,
  opcoes,
  ajuda,
}: {
  label: string;
  vazio: string;
  placeholder: string;
  valor: string;
  onChange: (v: string) => void;
  opcoes: { id: string; nome: string }[];
  ajuda?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {opcoes.length === 0 ? (
        <p className="text-[12.5px] text-steel">{vazio}</p>
      ) : (
        <>
          <Select value={valor || undefined} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {opcoes.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {ajuda && <p className="mt-2 text-[12px] text-steel">{ajuda}</p>}
        </>
      )}
    </div>
  );
}
