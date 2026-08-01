"use client";


import { useAcao } from "@/lib/acao-cliente";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardLabel } from "@/components/caverna/card";
import { configurarLembretePeso } from "@/app/actions/dieta";

const opcoes = [
  { label: "Não lembrar", value: "0" },
  { label: "A cada semana", value: "7" },
  { label: "A cada 15 dias", value: "15" },
  { label: "A cada mês", value: "30" },
];

export function LembretePesoCard({
  revisarACada,
  proximaRevisao,
  vencido,
}: {
  revisarACada: number | null;
  proximaRevisao: string | null;
  vencido: boolean;
}) {
  const [pending, executar] = useAcao();

  return (
    <Card className="col-span-12 lg:col-span-4">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-mist" strokeWidth={1.5} />
        <CardLabel>Lembrete de atualizar métricas</CardLabel>
      </div>

      <div className="mt-4">
        <Select
          value={String(revisarACada ?? 0)}
          onValueChange={(v) =>
            executar(async () => {
              await configurarLembretePeso(Number(v) || null);
              toast.success(Number(v) ? "Lembrete configurado" : "Lembrete desligado");
            })
          }
          disabled={pending}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opcoes.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {revisarACada && proximaRevisao && (
        <p className={`mt-3 text-[12.5px] ${vencido ? "text-amber" : "text-steel"}`}>
          {vencido
            ? "Está na hora de atualizar seu peso e métricas."
            : `Próxima atualização em ${proximaRevisao}.`}
        </p>
      )}
    </Card>
  );
}
