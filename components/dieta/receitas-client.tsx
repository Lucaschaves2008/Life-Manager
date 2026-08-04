"use client";

import { useMemo, useState } from "react";
import { useAcao } from "@/lib/acao-cliente";
import { ChevronDown, Copy, Pencil, Plus, Search, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/table";
import { Card, CardLabel } from "@/components/caverna/card";
import { DotsMenu } from "@/components/caverna/dots-menu";
import { EmptyState } from "@/components/caverna/empty-state";
import { ReceitaForm, type AlimentoOpcao } from "@/components/dieta/receita-form";
import { deleteReceita, duplicarReceita } from "@/app/actions/dieta";
import { rotuloIngrediente } from "@/lib/data/dieta-calc";
import type { ReceitaView } from "@/lib/data/dieta";
import { cn } from "@/lib/utils";

/**
 * Biblioteca de refeições: o que o usuário cozinha, separado de qualquer dieta.
 * A dieta só aponta pra cá (ver PlanoClient) — trocar de dieta não recadastra
 * nada, e editar o preparo aqui conserta em todas as dietas de uma vez.
 */
export function ReceitasClient({
  receitas,
  alimentos,
}: {
  receitas: ReceitaView[];
  alimentos: AlimentoOpcao[];
}) {
  const [, executar] = useAcao();
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<{ aberta: boolean; receita: ReceitaView | null }>({
    aberta: false,
    receita: null,
  });

  const termo = busca.trim().toLowerCase();
  const filtradas = useMemo(
    () =>
      receitas.filter(
        (r) =>
          r.nome.toLowerCase().includes(termo) ||
          r.ingredientes.some((i) => i.nome.toLowerCase().includes(termo))
      ),
    [receitas, termo]
  );

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardLabel>Biblioteca de refeições</CardLabel>
            <p className="mt-2 max-w-[62ch] text-[13px] text-mist">
              Cadastre uma vez com ingredientes e modo de preparo. Depois é só
              pendurar nas dietas que quiser — a mesma refeição pode estar no ganho
              de massa e, meses depois, na de perda.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setForm({ aberta: true, receita: null })}
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Nova refeição
          </Button>
        </div>

        {receitas.length > 0 && (
          <div className="relative mt-5">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel"
              strokeWidth={1.5}
            />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou ingrediente…"
              className="pl-9"
            />
          </div>
        )}

        <div className="mt-5">
          {receitas.length === 0 ? (
            <EmptyState
              icon={UtensilsCrossed}
              title="Nenhuma refeição cadastrada"
              description="Comece pelas que você já faz sempre — o café da manhã de sempre, o prato do almoço."
              className="py-14"
              action={
                <Button
                  variant="dashed"
                  size="sm"
                  onClick={() => setForm({ aberta: true, receita: null })}
                >
                  <Plus className="h-4 w-4" strokeWidth={1.5} />
                  Criar refeição
                </Button>
              }
            />
          ) : filtradas.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-steel">
              Nenhuma refeição com esse nome ou ingrediente.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {filtradas.map((receita) => (
                <CardReceita
                  key={receita.id}
                  receita={receita}
                  onEditar={() => setForm({ aberta: true, receita })}
                  onDuplicar={() =>
                    executar(async () => {
                      await duplicarReceita(receita.id);
                      toast.success("Refeição duplicada");
                    })
                  }
                  onExcluir={() =>
                    executar(async () => {
                      await deleteReceita(receita.id);
                      toast.success(
                        receita.usos > 0
                          ? "Refeição excluída e removida das dietas"
                          : "Refeição excluída"
                      );
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      <ReceitaForm
        aberta={form.aberta}
        onOpenChange={(v) => setForm((atual) => ({ ...atual, aberta: v }))}
        receita={form.receita}
        alimentos={alimentos}
      />
    </>
  );
}

function CardReceita({
  receita,
  onEditar,
  onDuplicar,
  onExcluir,
}: {
  receita: ReceitaView;
  onEditar: () => void;
  onDuplicar: () => void;
  onExcluir: () => void;
}) {
  const [aberta, setAberta] = useState(false);
  const passos = (receita.descricao ?? "").split("\n").filter((l) => l.trim());

  return (
    <div className="rounded-[14px] border border-stroke bg-surface-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[14px] text-paper">
            {receita.nome}
            {receita.usos > 0 ? (
              <StatusPill tone="mint">
                {receita.usos === 1 ? "em 1 dieta" : `em ${receita.usos} dietas`}
              </StatusPill>
            ) : (
              <span className="text-[11px] text-steel">fora de qualquer dieta</span>
            )}
          </p>
          <p className="tabular mt-1 text-[12.5px] text-mist">
            {Math.round(receita.macros.kcal)} kcal
            <span className="text-steel">
              {" · "}P {Math.round(receita.macros.prot)}g · C{" "}
              {Math.round(receita.macros.carb)}g · G {Math.round(receita.macros.gord)}g
              {receita.macrosManuais && " · informado na mão"}
            </span>
          </p>
        </div>
        <DotsMenu
          items={[
            { label: "Editar", icon: Pencil, onSelect: onEditar },
            { label: "Duplicar", icon: Copy, onSelect: onDuplicar },
            { label: "Excluir", icon: Trash2, destructive: true, onSelect: onExcluir },
          ]}
        />
      </div>

      {receita.ingredientes.length > 0 && (
        <p className="mt-2.5 text-[12px] text-mist">
          {receita.ingredientes.map((i) => rotuloIngrediente(i)).join(" · ")}
        </p>
      )}

      {passos.length > 0 && (
        <>
          <button
            onClick={() => setAberta((v) => !v)}
            className="mt-3 flex items-center gap-1.5 text-[12px] text-steel transition-colors hover:text-ice"
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", aberta && "rotate-180")}
              strokeWidth={1.5}
            />
            {aberta ? "Esconder o preparo" : `Como faz (${passos.length} passos)`}
          </button>
          {aberta && (
            <ol className="mt-2.5 flex flex-col gap-1.5 border-l border-stroke pl-3.5">
              {passos.map((passo, i) => (
                <li key={i} className="text-[12.5px] leading-relaxed text-mist">
                  {passo}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
