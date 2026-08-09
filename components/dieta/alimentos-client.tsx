"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useAcao } from "@/lib/acao-cliente";
import { Apple, Database, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { DotsMenu } from "@/components/caverna/dots-menu";
import { EmptyState } from "@/components/caverna/empty-state";
import { Segmented } from "@/components/caverna/segmented";
import {
  buscarCatalogoAlimentos,
  createAlimento,
  deleteAlimento,
  importarAlimentoCatalogo,
  restoreAlimento,
  updateAlimento,
  type AlimentoInput,
} from "@/app/actions/dieta";
import type { AlimentoCatalogoView } from "@/lib/data/alimentos-catalogo";

export type AlimentoView = AlimentoInput & { id: string; usadoEmRefeicoes: number };

const vazio: AlimentoInput = {
  nome: "",
  kcal100: 0,
  prot100: 0,
  carb100: 0,
  gord100: 0,
  porcaoNome: null,
  porcaoG: null,
};

function num(v: number | null): string {
  return v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export function AlimentosClient({ alimentos }: { alimentos: AlimentoView[] }) {
  const [, executar] = useAcao();
  const [pending, startSalvar] = useTransition();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<AlimentoInput>(vazio);
  const [modo, setModo] = useState<"buscar" | "manual">("buscar");

  // Catálogo pré-carregado (TACO): busca com debounce ao abrir o modo "Buscar".
  const [catalogoBusca, setCatalogoBusca] = useState("");
  const [doCatalogo, setDoCatalogo] = useState<AlimentoCatalogoView[]>([]);
  const [buscandoCatalogo, setBuscandoCatalogo] = useState(false);
  const [importandoId, setImportandoId] = useState<string | null>(null);

  useEffect(() => {
    const termo = catalogoBusca.trim();
    if (!termo || modo !== "buscar") {
      setDoCatalogo([]);
      return;
    }
    let cancelado = false;
    setBuscandoCatalogo(true);
    const timeout = setTimeout(async () => {
      try {
        const resultado = await buscarCatalogoAlimentos(termo);
        if (!cancelado) setDoCatalogo(resultado);
      } finally {
        if (!cancelado) setBuscandoCatalogo(false);
      }
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(timeout);
    };
  }, [catalogoBusca, modo]);

  function importar(item: AlimentoCatalogoView) {
    setImportandoId(item.id);
    startSalvar(async () => {
      try {
        await importarAlimentoCatalogo(item.id);
        toast.success("Alimento importado");
        setAberto(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível importar.");
      } finally {
        setImportandoId(null);
      }
    });
  }

  const filtrados = useMemo(
    () =>
      alimentos.filter((a) =>
        a.nome.toLowerCase().includes(busca.trim().toLowerCase())
      ),
    [alimentos, busca]
  );

  function abrir(alimento: AlimentoView | null) {
    setEditandoId(alimento?.id ?? null);
    setForm(
      alimento
        ? {
            nome: alimento.nome,
            kcal100: alimento.kcal100,
            prot100: alimento.prot100,
            carb100: alimento.carb100,
            gord100: alimento.gord100,
            porcaoNome: alimento.porcaoNome,
            porcaoG: alimento.porcaoG,
          }
        : vazio
    );
    setModo(alimento ? "manual" : "buscar");
    setCatalogoBusca("");
    setAberto(true);
  }

  const campos: { chave: keyof AlimentoInput; label: string }[] = [
    { chave: "kcal100", label: "Kcal / 100 g" },
    { chave: "prot100", label: "Proteína / 100 g" },
    { chave: "carb100", label: "Carbo / 100 g" },
    { chave: "gord100", label: "Gordura / 100 g" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel"
            strokeWidth={1.5}
          />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar alimento…"
            className="pl-9"
          />
        </div>
        <Button variant="primary" size="sm" onClick={() => abrir(null)}>
          <Plus className="h-4 w-4" strokeWidth={2} />
          Novo alimento
        </Button>
      </div>

      <div className="mt-4">
        {filtrados.length === 0 ? (
          <EmptyState
            icon={Apple}
            title={
              alimentos.length === 0
                ? "Nenhum alimento na biblioteca."
                : "Nenhum alimento com esse nome."
            }
            className="py-14"
          />
        ) : (
          <Table>
            <THead>
              <Th>Alimento</Th>
              <Th right>Kcal</Th>
              <Th right>P</Th>
              <Th right>C</Th>
              <Th right>G</Th>
              <Th>Porção</Th>
              <Th right> </Th>
            </THead>
            <tbody>
              {filtrados.map((a) => (
                <Tr key={a.id}>
                  <Td>{a.nome}</Td>
                  <Td right className="text-mist">
                    {num(a.kcal100)}
                  </Td>
                  <Td right className="text-mist">
                    {num(a.prot100)}
                  </Td>
                  <Td right className="text-mist">
                    {num(a.carb100)}
                  </Td>
                  <Td right className="text-mist">
                    {num(a.gord100)}
                  </Td>
                  <Td className="text-steel">
                    {a.porcaoNome ? `${a.porcaoNome} · ${a.porcaoG} g` : "—"}
                  </Td>
                  <Td right>
                    <DotsMenu
                      items={[
                        { label: "Editar", icon: Pencil, onSelect: () => abrir(a) },
                        {
                          label: "Excluir",
                          icon: Trash2,
                          destructive: true,
                          onSelect: () =>
                            executar(async () => {
                              const removido = await deleteAlimento(a.id);
                              if (!removido) return;
                              toast(
                                a.usadoEmRefeicoes > 0
                                  ? "Alimento excluído e removido das refeições"
                                  : "Alimento excluído",
                                {
                                  action: {
                                    label: "Desfazer",
                                    onClick: () =>
                                      restoreAlimento({
                                        nome: removido.nome,
                                        kcal100: removido.kcal100,
                                        prot100: removido.prot100,
                                        carb100: removido.carb100,
                                        gord100: removido.gord100,
                                        porcaoNome: removido.porcaoNome,
                                        porcaoG: removido.porcaoG,
                                      }),
                                  },
                                }
                              );
                            }),
                        },
                      ]}
                    />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>{editandoId ? "Editar alimento" : "Novo alimento"}</SheetTitle>

          {!editandoId && (
            <Segmented
              className="mt-4"
              options={[
                { label: "Buscar", value: "buscar" },
                { label: "Cadastro manual", value: "manual" },
              ]}
              value={modo}
              onChange={setModo}
            />
          )}

          {!editandoId && modo === "buscar" ? (
            <div className="mt-5">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel"
                  strokeWidth={1.5}
                />
                <Input
                  value={catalogoBusca}
                  onChange={(e) => setCatalogoBusca(e.target.value)}
                  placeholder="Buscar na tabela de alimentos…"
                  className="pl-9"
                  autoFocus
                />
              </div>
              <div className="mt-2 flex flex-col">
                {doCatalogo.map((c) => (
                  <button
                    key={c.id}
                    disabled={pending}
                    onClick={() => importar(c)}
                    className="flex items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 text-left text-[13px] text-mist transition-colors hover:bg-surface-2 hover:text-ice disabled:opacity-60"
                  >
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                      <Database className="h-3.5 w-3.5 shrink-0 text-steel" strokeWidth={1.5} />
                      <span className="truncate">{c.nome}</span>
                    </span>
                    <span className="tabular shrink-0 text-[11.5px] text-steel">
                      {importandoId === c.id
                        ? "Importando…"
                        : c.kcal100 == null
                          ? "—"
                          : `${Math.round(c.kcal100)} kcal/100g`}
                    </span>
                  </button>
                ))}
                {!buscandoCatalogo && catalogoBusca.trim() && doCatalogo.length === 0 && (
                  <p className="px-2 py-1.5 text-[12.5px] text-steel">
                    Nenhum item na tabela com esse nome.{" "}
                    <button
                      className="text-ice underline underline-offset-2"
                      onClick={() => {
                        setForm({ ...vazio, nome: catalogoBusca.trim() });
                        setModo("manual");
                      }}
                    >
                      Cadastrar na mão
                    </button>
                  </p>
                )}
                {!catalogoBusca.trim() && (
                  <p className="px-2 py-1.5 text-[12.5px] text-steel">
                    Digite o nome de um alimento pra buscar na tabela pré-carregada.
                  </p>
                )}
              </div>
            </div>
          ) : (
          <div className="mt-6 flex flex-col gap-5">
            <div>
              <Label htmlFor="food-nome">Nome</Label>
              <Input
                id="food-nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Peito de frango grelhado"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {campos.map((campo) => (
                <div key={campo.chave}>
                  <Label htmlFor={`food-${campo.chave}`}>{campo.label}</Label>
                  <Input
                    id={`food-${campo.chave}`}
                    type="number"
                    min={0}
                    step="0.1"
                    value={(form[campo.chave] as number | null) ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [campo.chave]:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="tabular"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="porcao-nome">Porção (opcional)</Label>
                <Input
                  id="porcao-nome"
                  value={form.porcaoNome ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, porcaoNome: e.target.value || null })
                  }
                  placeholder="1 unidade, 1 scoop"
                />
              </div>
              <div>
                <Label htmlFor="porcao-g">Gramas da porção</Label>
                <Input
                  id="porcao-g"
                  type="number"
                  min={0}
                  step="0.1"
                  value={form.porcaoG ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      porcaoG: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className="tabular"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                disabled={!form.nome.trim() || pending}
                onClick={() =>
                  startSalvar(async () => {
                    try {
                      if (editandoId) {
                        await updateAlimento(editandoId, form);
                        toast.success("Alimento atualizado");
                      } else {
                        await createAlimento(form);
                        toast.success("Alimento criado");
                      }
                      setAberto(false);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
                    }
                  })
                }
              >
                {pending ? "Salvando…" : "Salvar"}
              </Button>
              <Button variant="ghost" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
            </div>
          </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
