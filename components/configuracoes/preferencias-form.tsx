"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveSettings } from "@/app/actions/settings";
import {
  FUSOS,
  MOEDAS,
  PREF_FUSO,
  PREF_MOEDA,
  PREF_UNIDADE_DISTANCIA,
  PREF_UNIDADE_PESO,
  UNIDADES_DISTANCIA,
  UNIDADES_PESO,
} from "@/lib/preferencias";

type Valores = {
  moeda: string;
  fuso: string;
  peso: string;
  distancia: string;
};

/**
 * Moeda, fuso e unidades. A escolha é gravada, mas o app ainda exibe tudo em
 * BRL/kg/km — a conversão dos formatadores vem depois (ver lib/preferencias.ts).
 * Por isso o aviso explícito no rodapé: nada de prometer o que ainda não faz.
 */
export function PreferenciasForm({ iniciais }: { iniciais: Valores }) {
  const [valores, setValores] = useState(iniciais);
  const [pending, startTransition] = useTransition();

  function salvar(chave: string, valor: string, campo: keyof Valores) {
    const anterior = valores[campo];
    setValores((v) => ({ ...v, [campo]: valor }));
    startTransition(async () => {
      try {
        await saveSettings({ [chave]: valor });
      } catch {
        setValores((v) => ({ ...v, [campo]: anterior }));
        toast.error("Não foi possível salvar a preferência.");
      }
    });
  }

  const linhas = [
    {
      label: "Moeda",
      ajuda: "Usada nos valores de Finanças e Investimentos.",
      valor: valores.moeda,
      opcoes: MOEDAS,
      onChange: (v: string) => salvar(PREF_MOEDA, v, "moeda"),
      largura: "w-56",
    },
    {
      label: "Fuso horário",
      ajuda: "Define a virada do dia no checklist, streak e agenda.",
      valor: valores.fuso,
      opcoes: FUSOS,
      onChange: (v: string) => salvar(PREF_FUSO, v, "fuso"),
      largura: "w-64",
    },
    {
      label: "Peso",
      ajuda: "Unidade do diário de peso e das cargas de treino.",
      valor: valores.peso,
      opcoes: UNIDADES_PESO,
      onChange: (v: string) => salvar(PREF_UNIDADE_PESO, v, "peso"),
      largura: "w-56",
    },
    {
      label: "Distância",
      ajuda: "Unidade das corridas e do volume semanal.",
      valor: valores.distancia,
      opcoes: UNIDADES_DISTANCIA,
      onChange: (v: string) => salvar(PREF_UNIDADE_DISTANCIA, v, "distancia"),
      largura: "w-56",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {linhas.map((linha) => (
        <div
          key={linha.label}
          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
        >
          <div className="min-w-0">
            <p className="text-[13.5px] text-ice">{linha.label}</p>
            <p className="text-[12px] leading-relaxed text-steel">{linha.ajuda}</p>
          </div>
          <Select
            value={linha.valor}
            onValueChange={linha.onChange}
            disabled={pending}
          >
            <SelectTrigger className={`${linha.largura} shrink-0`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {linha.opcoes.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}

      <p className="rounded-[10px] border border-stroke bg-surface-2 px-3.5 py-2.5 text-[12px] leading-relaxed text-steel">
        Sua escolha fica salva, mas os valores ainda aparecem em real, kg e km —
        a conversão nas telas entra numa próxima etapa.
      </p>
    </div>
  );
}
