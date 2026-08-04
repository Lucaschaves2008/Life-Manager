"use client";

import { useMemo, useState, useTransition } from "react";
import { ChefHat, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Segmented } from "@/components/caverna/segmented";
import {
  createAlimento,
  createReceita,
  updateReceita,
  type AlimentoInput,
  type ReceitaInput,
} from "@/app/actions/dieta";
import { UNIDADES, kcalEstimada, rotuloIngrediente } from "@/lib/data/dieta-calc";
import type { Macros, ReceitaView } from "@/lib/data/dieta";
import { cn } from "@/lib/utils";

export type AlimentoOpcao = {
  id: string;
  nome: string;
  kcal100: number | null;
  prot100: number | null;
  carb100: number | null;
  gord100: number | null;
  porcaoNome: string | null;
  porcaoG: number | null;
};

/** Ingrediente enquanto está sendo editado — quantidade é texto até salvar. */
type LinhaIngrediente = {
  chave: string;
  foodId: string;
  quantidade: string;
  unidade: string;
};

const macrosVazios = { kcal: "", prot: "", carb: "", gord: "" };

function numero(texto: string): number | null {
  const limpo = texto.trim().replace(",", ".");
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

let contador = 0;
const novaChave = () => `linha-${contador++}`;

/**
 * Cadastro de uma refeição da biblioteca: nome, ingredientes (com alimento
 * criado na hora, sem sair da tela), macros e o modo de preparo.
 *
 * Serve tanto pra biblioteca quanto pro plano — quando `aoSalvar` é passado, o
 * chamador recebe o id e pode, por exemplo, já vincular a refeição num horário.
 */
export function ReceitaForm({
  aberta,
  onOpenChange,
  receita,
  alimentos,
  aoSalvar,
}: {
  aberta: boolean;
  onOpenChange: (v: boolean) => void;
  /** null = nova refeição */
  receita: ReceitaView | null;
  alimentos: AlimentoOpcao[];
  aoSalvar?: (receitaId: string) => void | Promise<void>;
}) {
  return (
    <Sheet open={aberta} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        {/* O formulário só existe enquanto o sheet está aberto, e a key o
            remonta ao trocar de refeição. É o que garante que uma revalidação
            do servidor no meio da digitação não jogue o texto fora: o estado
            nasce das props uma vez, no mount, e nunca mais é sobrescrito. */}
        <FormularioReceita
          key={receita?.id ?? "nova"}
          receita={receita}
          alimentos={alimentos}
          onFechar={() => onOpenChange(false)}
          aoSalvar={aoSalvar}
        />
      </SheetContent>
    </Sheet>
  );
}

function FormularioReceita({
  receita,
  alimentos,
  onFechar,
  aoSalvar,
}: {
  receita: ReceitaView | null;
  alimentos: AlimentoOpcao[];
  onFechar: () => void;
  aoSalvar?: (receitaId: string) => void | Promise<void>;
}) {
  const [pending, startSalvar] = useTransition();
  const [nome, setNome] = useState(receita?.nome ?? "");
  const [descricao, setDescricao] = useState(receita?.descricao ?? "");
  const [linhas, setLinhas] = useState<LinhaIngrediente[]>(() =>
    (receita?.ingredientes ?? []).map((i) => ({
      chave: novaChave(),
      foodId: i.foodId,
      quantidade: i.quantidade == null ? "" : String(i.quantidade),
      unidade: i.unidade,
    }))
  );
  const [modoMacros, setModoMacros] = useState<"auto" | "manual">(
    receita?.macrosManuais ? "manual" : "auto"
  );
  const [macros, setMacros] = useState(() =>
    receita?.macrosManuais
      ? {
          kcal: String(Math.round(receita.macros.kcal)),
          prot: String(Math.round(receita.macros.prot)),
          carb: String(Math.round(receita.macros.carb)),
          gord: String(Math.round(receita.macros.gord)),
        }
      : macrosVazios
  );
  const [adicionando, setAdicionando] = useState(false);

  const porId = useMemo(() => new Map(alimentos.map((a) => [a.id, a])), [alimentos]);

  const calculados: Macros = useMemo(() => {
    return linhas.reduce<Macros>(
      (soma, linha) => {
        const food = porId.get(linha.foodId);
        const qtd = numero(linha.quantidade);
        if (!food || qtd == null) return soma;
        const gramas = linha.unidade === "porcao" ? qtd * (food.porcaoG ?? 100) : qtd;
        const fator = gramas / 100;
        return {
          kcal: soma.kcal + (food.kcal100 ?? 0) * fator,
          prot: soma.prot + (food.prot100 ?? 0) * fator,
          carb: soma.carb + (food.carb100 ?? 0) * fator,
          gord: soma.gord + (food.gord100 ?? 0) * fator,
        };
      },
      { kcal: 0, prot: 0, carb: 0, gord: 0 }
    );
  }, [linhas, porId]);

  function salvar() {
    const ingredientes = linhas
      .filter((l) => l.foodId)
      .map((l) => ({
        foodId: l.foodId,
        quantidade: numero(l.quantidade),
        unidade: l.unidade,
      }));

    const manuais =
      modoMacros === "manual"
        ? {
            kcal: numero(macros.kcal) ?? 0,
            prot: numero(macros.prot) ?? 0,
            carb: numero(macros.carb) ?? 0,
            gord: numero(macros.gord) ?? 0,
          }
        : null;

    const input: ReceitaInput = {
      nome,
      descricao,
      macrosManuais: manuais,
      ingredientes,
    };

    startSalvar(async () => {
      try {
        const id = receita
          ? (await updateReceita(receita.id, input), receita.id)
          : await createReceita(input);
        toast.success(receita ? "Refeição atualizada" : "Refeição criada");
        await aoSalvar?.(id);
        onFechar();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
      }
    });
  }

  const camposMacro: { chave: keyof typeof macros; label: string }[] = [
    { chave: "kcal", label: "Kcal" },
    { chave: "prot", label: "Proteína (g)" },
    { chave: "carb", label: "Carbo (g)" },
    { chave: "gord", label: "Gordura (g)" },
  ];

  return (
    <>
      <SheetTitle>{receita ? "Editar refeição" : "Nova refeição"}</SheetTitle>
      <p className="mt-1 text-[12.5px] text-steel">
        Ela fica na sua biblioteca e pode entrar em quantas dietas você quiser.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        <div>
          <Label htmlFor="receita-nome">Nome da refeição</Label>
          <Input
            id="receita-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Panqueca proteica de banana"
            autoFocus
          />
        </div>

        {/* ---------- Ingredientes ---------- */}
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <Label className="mb-0">Ingredientes</Label>
            <span className="text-[11.5px] text-steel">
              deixe a quantidade vazia para “a gosto”
            </span>
          </div>

          <div className="mt-2.5 flex flex-col gap-2">
            {linhas.map((linha, i) => {
              const food = porId.get(linha.foodId);
              return (
                <div
                  key={linha.chave}
                  className="rounded-[11px] border border-stroke bg-surface-2 p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ice">
                      {food?.nome ?? "Alimento removido"}
                    </span>
                    <button
                      aria-label={`Remover ${food?.nome ?? "ingrediente"}`}
                      onClick={() =>
                        setLinhas((atuais) => atuais.filter((_, idx) => idx !== i))
                      }
                      className="rounded-md p-1 text-steel transition-colors hover:text-coral"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Input
                      aria-label={`Quantidade de ${food?.nome ?? "ingrediente"}`}
                      inputMode="decimal"
                      value={linha.quantidade}
                      onChange={(e) =>
                        setLinhas((atuais) =>
                          atuais.map((l, idx) =>
                            idx === i ? { ...l, quantidade: e.target.value } : l
                          )
                        )
                      }
                      placeholder="a gosto"
                      className="tabular h-8 flex-1"
                    />
                    <Segmented
                      options={UNIDADES.map((u) => ({
                        label: u.valor === "porcao" ? food?.porcaoNome ?? "porção" : u.label,
                        value: u.valor,
                      }))}
                      value={linha.unidade}
                      onChange={(v) =>
                        setLinhas((atuais) =>
                          atuais.map((l, idx) => (idx === i ? { ...l, unidade: v } : l))
                        )
                      }
                    />
                  </div>
                  {food && (
                    <p className="mt-1.5 text-[11.5px] text-steel">
                      {rotuloIngrediente({
                        nome: food.nome,
                        quantidade: numero(linha.quantidade),
                        unidade: linha.unidade,
                        porcaoNome: food.porcaoNome,
                      })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {adicionando ? (
            <BuscaAlimento
              alimentos={alimentos}
              onEscolher={(foodId) => {
                setLinhas((atuais) => [
                  ...atuais,
                  { chave: novaChave(), foodId, quantidade: "", unidade: "g" },
                ]);
                setAdicionando(false);
              }}
              onCancelar={() => setAdicionando(false)}
            />
          ) : (
            <Button
              variant="dashed"
              size="sm"
              className="mt-2 w-full"
              onClick={() => setAdicionando(true)}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              Adicionar ingrediente
            </Button>
          )}
        </div>

        {/* ---------- Macros ---------- */}
        <div>
          <Label className="mb-0">Macros</Label>
          <div className="mt-2 flex items-center justify-between gap-3">
            <Segmented
              options={[
                { label: "Somar ingredientes", value: "auto" },
                { label: "Informar na mão", value: "manual" },
              ]}
              value={modoMacros}
              onChange={(v) => {
                setModoMacros(v);
                // Ao trocar pra manual, parte do que os ingredientes já dão —
                // corrigir um número é mais rápido que digitar quatro.
                if (v === "manual" && !numero(macros.kcal)) {
                  setMacros({
                    kcal: String(Math.round(calculados.kcal)),
                    prot: String(Math.round(calculados.prot)),
                    carb: String(Math.round(calculados.carb)),
                    gord: String(Math.round(calculados.gord)),
                  });
                }
              }}
            />
          </div>

          {modoMacros === "auto" ? (
            <p className="tabular mt-3 text-[13px] text-mist">
              {Math.round(calculados.kcal)} kcal
              <span className="text-steel">
                {" · "}P {Math.round(calculados.prot)}g · C {Math.round(calculados.carb)}g
                · G {Math.round(calculados.gord)}g
              </span>
            </p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {camposMacro.map((campo) => (
                  <div key={campo.chave}>
                    <Label htmlFor={`receita-${campo.chave}`}>{campo.label}</Label>
                    <Input
                      id={`receita-${campo.chave}`}
                      inputMode="decimal"
                      value={macros[campo.chave]}
                      onChange={(e) =>
                        setMacros({ ...macros, [campo.chave]: e.target.value })
                      }
                      className="tabular"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11.5px] text-steel">
                Pelos macros digitados: ≈{" "}
                {Math.round(
                  kcalEstimada({
                    prot: numero(macros.prot) ?? 0,
                    carb: numero(macros.carb) ?? 0,
                    gord: numero(macros.gord) ?? 0,
                  })
                )}{" "}
                kcal. Use quando a refeição for uma regra de prato, não uma receita.
              </p>
            </>
          )}
        </div>

        {/* ---------- Preparo ---------- */}
        <div>
          <Label htmlFor="receita-preparo">Modo de preparo</Label>
          <Textarea
            id="receita-preparo"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={
              "1. Amassa a banana até virar purê.\n2. Junta os ovos e bate com o garfo.\n3. Frigideira em fogo baixo com manteiga…"
            }
            className="min-h-40"
          />
          <p className="mt-1.5 text-[11.5px] text-steel">
            Um passo por linha. É o que vai aparecer na hora de cozinhar.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={salvar}
            disabled={!nome.trim() || pending}
          >
            {pending ? "Salvando…" : "Salvar refeição"}
          </Button>
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
        </div>
      </div>
    </>
  );
}

/**
 * Busca um alimento da biblioteca — e, se ele não existir, cadastra na hora
 * sem sair do cadastro da refeição (era o passo que obrigava a abandonar a
 * receita no meio pra ir na aba Alimentos).
 */
function BuscaAlimento({
  alimentos,
  onEscolher,
  onCancelar,
}: {
  alimentos: AlimentoOpcao[];
  onEscolher: (foodId: string) => void;
  onCancelar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  const [pending, startCriar] = useTransition();
  const [novo, setNovo] = useState<AlimentoInput>({
    nome: "",
    kcal100: null,
    prot100: null,
    carb100: null,
    gord100: null,
    porcaoNome: null,
    porcaoG: null,
  });

  const termo = busca.trim().toLowerCase();
  const achados = useMemo(
    () =>
      (termo
        ? alimentos.filter((a) => a.nome.toLowerCase().includes(termo))
        : alimentos
      ).slice(0, 8),
    [alimentos, termo]
  );

  const campos: { chave: keyof AlimentoInput; label: string }[] = [
    { chave: "kcal100", label: "Kcal / 100 g" },
    { chave: "prot100", label: "Proteína / 100 g" },
    { chave: "carb100", label: "Carbo / 100 g" },
    { chave: "gord100", label: "Gordura / 100 g" },
  ];

  if (criando) {
    return (
      <div className="mt-2 rounded-[11px] border border-stroke bg-surface-2 p-3">
        <p className="microlabel">Novo alimento</p>
        <div className="mt-3 flex flex-col gap-3">
          <Input
            aria-label="Nome do alimento"
            value={novo.nome}
            onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
            placeholder="Requeijão cremoso"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2.5">
            {campos.map((campo) => (
              <div key={campo.chave}>
                <Label htmlFor={`novo-${campo.chave}`}>{campo.label}</Label>
                <Input
                  id={`novo-${campo.chave}`}
                  inputMode="decimal"
                  value={(novo[campo.chave] as number | null) ?? ""}
                  onChange={(e) =>
                    setNovo({
                      ...novo,
                      [campo.chave]: numero(e.target.value),
                    })
                  }
                  className="tabular h-8"
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <Label htmlFor="novo-porcao">Medida caseira</Label>
              <Input
                id="novo-porcao"
                value={novo.porcaoNome ?? ""}
                onChange={(e) => setNovo({ ...novo, porcaoNome: e.target.value || null })}
                placeholder="colher de sopa"
                className="h-8"
              />
            </div>
            <div>
              <Label htmlFor="novo-porcao-g">Gramas dela</Label>
              <Input
                id="novo-porcao-g"
                inputMode="decimal"
                value={novo.porcaoG ?? ""}
                onChange={(e) => setNovo({ ...novo, porcaoG: numero(e.target.value) })}
                className="tabular h-8"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={!novo.nome.trim() || pending}
              onClick={() =>
                startCriar(async () => {
                  try {
                    const id = await createAlimento(novo);
                    toast.success("Alimento criado");
                    onEscolher(id);
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : "Não foi possível salvar."
                    );
                  }
                })
              }
            >
              {pending ? "Salvando…" : "Criar e usar"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCriando(false)}>
              Voltar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-[11px] border border-stroke bg-surface-2 p-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-steel"
          strokeWidth={1.5}
        />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar alimento…"
          className="h-8 pl-8"
          autoFocus
        />
      </div>

      <div className="mt-2 flex flex-col">
        {achados.map((a) => (
          <button
            key={a.id}
            onClick={() => onEscolher(a.id)}
            className={cn(
              "flex items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 text-left",
              "text-[12.5px] text-mist transition-colors hover:bg-surface-1 hover:text-ice"
            )}
          >
            <span className="truncate">{a.nome}</span>
            <span className="tabular shrink-0 text-[11px] text-steel">
              {a.kcal100 == null ? "—" : `${Math.round(a.kcal100)} kcal/100g`}
            </span>
          </button>
        ))}
        {achados.length === 0 && (
          <p className="px-2 py-1.5 text-[12.5px] text-steel">
            Nenhum alimento com esse nome.
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Button
          variant="soft"
          size="sm"
          onClick={() => {
            setNovo((atual) => ({ ...atual, nome: busca.trim() }));
            setCriando(true);
          }}
        >
          <ChefHat className="h-3.5 w-3.5" strokeWidth={1.5} />
          {busca.trim() ? `Cadastrar “${busca.trim()}”` : "Cadastrar alimento novo"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
