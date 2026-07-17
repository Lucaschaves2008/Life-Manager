"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  createGoal,
  deleteGoal,
  restoreGoal,
  toggleGoal,
} from "@/app/actions/goals";
import { cn } from "@/lib/utils";

export type GoalItem = {
  id: string;
  titulo: string;
  feito: boolean;
  mes: string;
};

/** Checklist de metas (3.5.8) com CRUD e undo na exclusão. */
export function GoalsChecklist({
  goals,
  mes: mesProp,
}: {
  goals: GoalItem[];
  mes?: string;
}) {
  const [, startTransition] = useTransition();
  const [optimistic, apply] = useOptimistic(
    goals,
    (
      state,
      action:
        | { tipo: "toggle"; id: string; feito: boolean }
        | { tipo: "remove"; id: string }
    ) => {
      if (action.tipo === "toggle")
        return state.map((g) =>
          g.id === action.id ? { ...g, feito: action.feito } : g
        );
      return state.filter((g) => g.id !== action.id);
    }
  );
  const [adding, setAdding] = useState(false);
  const [titulo, setTitulo] = useState("");

  const mes =
    mesProp ?? goals[0]?.mes ?? new Date().toISOString().slice(0, 7);

  return (
    <div className="flex flex-col gap-1">
      {optimistic.length === 0 && !adding && (
        <p className="py-3 text-[13px] text-steel">
          Nenhuma meta para este mês ainda.
        </p>
      )}

      {optimistic.map((goal) => (
        <div
          key={goal.id}
          className="group flex items-center gap-3 rounded-[10px] px-2 py-2 transition-colors hover:bg-surface-2/60"
        >
          <Checkbox
            checked={goal.feito}
            onCheckedChange={(v) => {
              startTransition(() => {
                apply({ tipo: "toggle", id: goal.id, feito: v === true });
                toggleGoal(goal.id, v === true);
              });
            }}
            aria-label={goal.titulo}
          />
          <span
            className={cn(
              "flex-1 text-[13.5px]",
              goal.feito ? "text-steel line-through" : "text-ice"
            )}
          >
            {goal.titulo}
          </span>
          <button
            aria-label="Excluir meta"
            onClick={() => {
              startTransition(() => {
                apply({ tipo: "remove", id: goal.id });
                deleteGoal(goal.id);
              });
              toast("Meta excluída", {
                action: {
                  label: "Desfazer",
                  onClick: () => restoreGoal(goal.titulo, goal.mes, goal.feito),
                },
              });
            }}
            className="rounded-md p-1 text-steel opacity-0 transition-opacity hover:text-coral group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      ))}

      {adding ? (
        <form
          className="mt-1 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = titulo.trim();
            if (!value) return setAdding(false);
            startTransition(() => createGoal(value, mes));
            setTitulo("");
            setAdding(false);
          }}
        >
          <Input
            autoFocus
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={() => !titulo.trim() && setAdding(false)}
            placeholder="Nova meta do mês…"
            className="h-8.5"
          />
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-1.5 inline-flex items-center justify-center gap-1.5 rounded-full border border-dashed border-stroke py-1.5 text-[12.5px] text-mist transition-colors hover:border-mint hover:text-mint"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          Adicionar meta
        </button>
      )}
    </div>
  );
}
