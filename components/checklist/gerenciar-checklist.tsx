"use client";

import { useMemo, useState } from "react";
import { Copy, ListChecks, Pencil, Plus, Trash2, X } from "lucide-react";
import { useAcao } from "@/lib/acao-cliente";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DotsMenu } from "@/components/caverna/dots-menu";
import { TIPO_META } from "@/components/checklist/item-form";
import { excluirRotinaTemplate, excluirRotinaTemplates, removerRotinaDias } from "@/app/actions/rotinas";
import { DIAS_SEMANA_ORDEM, DIA_CURTO, DIA_NOME, diasDoItem } from "@/lib/rotina-dias";
import type { RotinaPlanoView, RotinaTemplateView } from "@/lib/data/rotinas";
import { cn } from "@/lib/utils";

type Alvo = { id: string; dia: number };
const chave = (a: Alvo) => `${a.id}|${a.dia}`;

type Confirmacao = { alvos: Alvo[]; titulo: string };

function listaDias(dias: number[]): string {
  return dias.length === 7 ? "todos os dias" : dias.map((d) => DIA_CURTO[d]).join(", ");
}

/**
 * Gerenciar checklist organizado pela semana: cada dia é uma seção com os
 * itens que caem nele. Um item que se repete (ex.: seg+ter+qua) aparece em
 * cada um desses dias — é UM item só por baixo, e ao apagar o app pergunta se
 * é só daquele dia ou de todos. Também há modo de seleção para apagar em massa.
 */
export function GerenciarChecklist({
  templates,
  planos,
  onEditar,
  onDuplicar,
  onNovo,
}: {
  templates: RotinaTemplateView[];
  planos: RotinaPlanoView[];
  onEditar: (t: RotinaTemplateView) => void;
  onDuplicar: (id: string) => void;
  onNovo: () => void;
}) {
  const [pending, executar] = useAcao();
  const [selecionando, setSelecionando] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState<Confirmacao | null>(null);

  const dias = useMemo(
    () => new Map(templates.map((t) => [t.id, diasDoItem(t.rrule, t.dataInicio)])),
    [templates]
  );
  const porId = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);

  // Itens de cada dia: com hora primeiro (crescente), depois os sem hora na
  // ordem manual — o mesmo critério da lista do dia.
  const secoes = useMemo(
    () =>
      DIAS_SEMANA_ORDEM.map((dia) => ({
        dia,
        itens: templates
          .filter((t) => dias.get(t.id)?.includes(dia))
          .sort((a, b) => {
            if (a.horaInicio && b.horaInicio) return a.horaInicio.localeCompare(b.horaInicio);
            if (a.horaInicio) return -1;
            if (b.horaInicio) return 1;
            return a.ordem - b.ordem;
          }),
      })),
    [templates, dias]
  );

  const todosAlvos: Alvo[] = secoes.flatMap((s) => s.itens.map((t) => ({ id: t.id, dia: s.dia })));
  const todosMarcados = todosAlvos.length > 0 && todosAlvos.every((a) => marcados.has(chave(a)));

  function alternar(alvo: Alvo) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(chave(alvo))) novo.add(chave(alvo));
      return novo;
    });
  }

  function alternarDia(dia: number) {
    const alvos = secoes.find((s) => s.dia === dia)!.itens.map((t) => ({ id: t.id, dia }));
    const tudo = alvos.length > 0 && alvos.every((a) => marcados.has(chave(a)));
    setMarcados((atual) => {
      const novo = new Set(atual);
      for (const a of alvos) {
        if (tudo) novo.delete(chave(a));
        else novo.add(chave(a));
      }
      return novo;
    });
  }

  function sairDaSelecao() {
    setSelecionando(false);
    setMarcados(new Set());
  }

  function pedirExclusao(alvos: Alvo[], titulo: string) {
    if (alvos.length === 0) return;
    // Sem repetição para escolher (item de um dia só): não há o que perguntar.
    const precisaPerguntar = alvos.some((a) => (dias.get(a.id)?.length ?? 1) > 1);
    if (!precisaPerguntar) {
      executar(() => excluirRotinaTemplates([...new Set(alvos.map((a) => a.id))]), {
        sucesso: alvos.length === 1 ? "Item removido" : `${alvos.length} itens removidos`,
      });
      sairDaSelecao();
      return;
    }
    setConfirmando({ alvos, titulo });
  }

  function aplicar(modo: "dia" | "todos") {
    const c = confirmando;
    if (!c) return;
    const ids = [...new Set(c.alvos.map((a) => a.id))];
    setConfirmando(null);
    sairDaSelecao();
    if (modo === "todos") {
      executar(
        () => (ids.length === 1 ? excluirRotinaTemplate(ids[0]) : excluirRotinaTemplates(ids)),
        { sucesso: ids.length === 1 ? "Item removido de todos os dias" : `${ids.length} itens removidos` }
      );
    } else {
      executar(() => removerRotinaDias(c.alvos), {
        sucesso: c.alvos.length === 1 ? `Removido só de ${DIA_NOME[c.alvos[0].dia]}` : "Removido dos dias selecionados",
      });
    }
  }

  const unico = confirmando && confirmando.alvos.length === 1 ? confirmando.alvos[0] : null;
  const unicoItem = unico ? porId.get(unico.id) : null;
  const idsConfirmacao = confirmando ? [...new Set(confirmando.alvos.map((a) => a.id))] : [];

  return (
    <div className="mt-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {selecionando ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMarcados(todosMarcados ? new Set() : new Set(todosAlvos.map(chave)))}
            >
              {todosMarcados ? "Limpar seleção" : "Selecionar tudo"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={marcados.size === 0 || pending}
              onClick={() =>
                pedirExclusao(
                  todosAlvos.filter((a) => marcados.has(chave(a))),
                  `Apagar ${marcados.size} ${marcados.size === 1 ? "item" : "itens"}`
                )
              }
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              Apagar{marcados.size > 0 ? ` (${marcados.size})` : ""}
            </Button>
            <Button variant="outline" size="sm" onClick={sairDaSelecao}>
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              Cancelar
            </Button>
          </>
        ) : (
          templates.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setSelecionando(true)}>
              <ListChecks className="h-3.5 w-3.5" strokeWidth={1.5} />
              Selecionar
            </Button>
          )
        )}
      </div>

      {templates.length === 0 && (
        <p className="text-[12.5px] text-steel">Nenhum item cadastrado ainda.</p>
      )}

      {templates.length > 0 &&
        secoes.map(({ dia, itens }) => {
          const alvos = itens.map((t) => ({ id: t.id, dia }));
          const diaTodo = alvos.length > 0 && alvos.every((a) => marcados.has(chave(a)));
          return (
            <section key={dia} className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                {selecionando && alvos.length > 0 && (
                  <Checkbox
                    checked={diaTodo}
                    onCheckedChange={() => alternarDia(dia)}
                    aria-label={`Selecionar todos de ${DIA_NOME[dia]}`}
                  />
                )}
                <p className="microlabel">{DIA_NOME[dia]}</p>
                <span className="tabular text-[11px] text-steel">{itens.length}</span>
              </div>

              {itens.length === 0 && (
                <p className="rounded-[14px] border border-dashed border-stroke px-3 py-2.5 text-[12px] text-steel/70">
                  Nada planejado
                </p>
              )}

              {itens.map((t) => {
                const alvo = { id: t.id, dia };
                const outros = (dias.get(t.id) ?? []).filter((d) => d !== dia);
                const marcado = marcados.has(chave(alvo));
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[14px] border bg-surface-2 px-3 py-2.5 transition-colors",
                      marcado ? "border-mint/50" : "border-stroke"
                    )}
                  >
                    {selecionando && (
                      <Checkbox
                        checked={marcado}
                        onCheckedChange={() => alternar(alvo)}
                        aria-label={`Selecionar ${t.nome}`}
                      />
                    )}
                    <span className="text-[14px]">{(TIPO_META[t.tipo] ?? TIPO_META.livre).emoji}</span>
                    <span className="tabular w-[4.25rem] shrink-0 text-[12px] text-steel">
                      {t.horaInicio ? t.horaInicio : "–"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-ice">{t.nome}</p>
                      {(outros.length > 0 || (planos.length > 0 && t.planoId)) && (
                        <p className="truncate text-[11px] text-steel">
                          {outros.length > 0 && `também: ${listaDias(outros)}`}
                          {outros.length > 0 && planos.length > 0 && t.planoId && " · "}
                          {planos.length > 0 && t.planoId && planos.find((p) => p.id === t.planoId)?.nome}
                        </p>
                      )}
                    </div>
                    {!selecionando && (
                      <DotsMenu
                        items={[
                          { label: "Editar", icon: Pencil, onSelect: () => onEditar(t) },
                          { label: "Duplicar", icon: Copy, onSelect: () => onDuplicar(t.id) },
                          {
                            label: "Excluir",
                            icon: Trash2,
                            destructive: true,
                            onSelect: () => pedirExclusao([alvo], `Excluir “${t.nome}”`),
                          },
                        ]}
                      />
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}

      <Button variant="outline" onClick={onNovo}>
        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
        Novo item
      </Button>

      <Dialog open={!!confirmando} onOpenChange={(v) => !v && setConfirmando(null)}>
        <DialogContent>
          {confirmando && (
            <div className="flex flex-col gap-4">
              <div>
                <DialogTitle className="text-[20px]">{confirmando.titulo}?</DialogTitle>
                <DialogDescription>
                  {unico && unicoItem
                    ? `Esse item também aparece em ${listaDias(
                        (dias.get(unico.id) ?? []).filter((d) => d !== unico.dia)
                      )}. Quer apagar só de ${DIA_NOME[unico.dia]} ou de todos os dias?`
                    : "Itens que se repetem em mais de um dia podem sair só dos dias selecionados ou de todos os dias."}
                </DialogDescription>
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="outline" disabled={pending} onClick={() => aplicar("dia")}>
                  {unico
                    ? `Só em ${DIA_NOME[unico.dia]}`
                    : "Só nos dias selecionados"}
                </Button>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => aplicar("todos")}
                  className="text-red-400 hover:text-red-300"
                >
                  {unico && unicoItem
                    ? `Em todos os dias (${listaDias(dias.get(unico.id) ?? [])})`
                    : `Os ${idsConfirmacao.length} ${idsConfirmacao.length === 1 ? "item inteiro" : "itens inteiros"}, em todos os dias`}
                </Button>
                <Button variant="outline" onClick={() => setConfirmando(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
