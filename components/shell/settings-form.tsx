"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { saveSettings } from "@/app/actions/settings";

export type SettingField = {
  key: string;
  label: string;
  sufixo?: string;
  tipo?: "texto" | "numero";
  ajuda?: string;
};

/** Formulário de chave/valor das configurações, com salvar único e toast. */
export function SettingsForm({
  fields,
  values,
}: {
  fields: SettingField[];
  values: Record<string, string>;
}) {
  const [form, setForm] = useState(values);
  const [pending, startTransition] = useTransition();

  const sujo = fields.some((f) => (form[f.key] ?? "") !== (values[f.key] ?? ""));

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await saveSettings(form);
          toast.success("Configurações salvas");
        });
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key}>
            <Label htmlFor={field.key}>{field.label}</Label>
            <div className="relative">
              <Input
                id={field.key}
                inputMode={field.tipo === "texto" ? "text" : "numeric"}
                type={field.tipo === "texto" ? "text" : "number"}
                value={form[field.key] ?? ""}
                onChange={(e) =>
                  setForm((s) => ({ ...s, [field.key]: e.target.value }))
                }
                className={field.tipo === "texto" ? undefined : "tabular pr-12"}
              />
              {field.sufixo && (
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] text-steel">
                  {field.sufixo}
                </span>
              )}
            </div>
            {field.ajuda && (
              <p className="mt-1.5 text-[11.5px] text-steel">{field.ajuda}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="sm" disabled={!sujo || pending}>
          {pending ? "Salvando…" : "Salvar alterações"}
        </Button>
        {sujo && !pending && (
          <span className="text-[12.5px] text-steel">Alterações não salvas</span>
        )}
      </div>
    </form>
  );
}
