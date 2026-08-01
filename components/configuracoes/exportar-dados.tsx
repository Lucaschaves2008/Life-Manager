"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const CONJUNTOS: { value: string; label: string }[] = [
  { value: "transacoes", label: "Transações" },
  { value: "ativos", label: "Ativos" },
  { value: "movimentos", label: "Movimentos" },
  { value: "treinos", label: "Treinos" },
  { value: "corridas", label: "Corridas" },
  { value: "peso", label: "Peso" },
  { value: "estudos", label: "Estudos" },
];

/**
 * Baixa os dados do usuário. Links diretos para /api/exportar — o download é
 * do navegador, sem estado no cliente. A rota é somente leitura.
 */
export function ExportarDados() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-[13.5px] text-ice">Tudo em um arquivo</p>
          <p className="text-[12px] leading-relaxed text-steel">
            JSON com finanças, investimentos, treinos, corridas, peso e estudos.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <a href="/api/exportar?formato=json" download>
            <Download className="h-4 w-4" strokeWidth={1.5} />
            Baixar JSON
          </a>
        </Button>
      </div>

      <div>
        <p className="text-[13.5px] text-ice">Planilhas por módulo</p>
        <p className="text-[12px] leading-relaxed text-steel">
          Um CSV por conjunto, pronto para abrir no Excel ou Google Planilhas.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CONJUNTOS.map((c) => (
            <Button key={c.value} variant="dashed" size="sm" asChild>
              <a href={`/api/exportar?formato=csv&conjunto=${c.value}`} download>
                {c.label}
              </a>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
