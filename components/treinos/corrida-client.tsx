"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Footprints, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { DotsMenu } from "@/components/caverna/dots-menu";
import { EmptyState } from "@/components/caverna/empty-state";
import {
  createRun,
  deleteRun,
  restoreRun,
  updateRun,
  type CorridaInput,
} from "@/app/actions/treinos";
import { formatDuracao, formatPace } from "@/lib/data/treinos";
import { cn } from "@/lib/utils";

export type CorridaView = {
  id: string;
  data: string;
  dataLabel: string;
  km: number;
  segundos: number;
  tipo: string;
  sensacao: number;
  notas: string | null;
};

const tipos = ["Leve", "Moderado", "Intervalado", "Longão"];

export function CorridaClient({
  corridas,
  hoje,
}: {
  corridas: CorridaView[];
  hoje: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [pending, startSalvar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [data, setData] = useState(hoje);
  const [km, setKm] = useState("");
  const [h, setH] = useState("0");
  const [min, setMin] = useState("");
  const [seg, setSeg] = useState("");
  const [tipo, setTipo] = useState("Leve");
  const [sensacao, setSensacao] = useState(3);
  const [notas, setNotas] = useState("");

  const abrirNovo = params.get("novo") === "1";
  useEffect(() => {
    if (abrirNovo) setAberto(true);
  }, [abrirNovo]);

  const segundos =
    (Number(h) || 0) * 3600 + (Number(min) || 0) * 60 + (Number(seg) || 0);
  const kmNum = Number(km.replace(",", ".")) || 0;
  const pace = kmNum > 0 && segundos > 0 ? segundos / kmNum : 0;

  function abrir(corrida: CorridaView | null) {
    setEditandoId(corrida?.id ?? null);
    setData(corrida?.data ?? hoje);
    setKm(corrida ? String(corrida.km) : "");
    setH(corrida ? String(Math.floor(corrida.segundos / 3600)) : "0");
    setMin(corrida ? String(Math.floor((corrida.segundos % 3600) / 60)) : "");
    setSeg(corrida ? String(corrida.segundos % 60) : "");
    setTipo(corrida?.tipo ?? "Leve");
    setSensacao(corrida?.sensacao ?? 3);
    setNotas(corrida?.notas ?? "");
    setAberto(true);
  }

  function fechar(v: boolean) {
    setAberto(v);
    if (!v && abrirNovo) {
      const next = new URLSearchParams(params.toString());
      next.delete("novo");
      router.replace(`/treinos?${next.toString()}`);
    }
  }

  function salvar() {
    const payload: CorridaInput = {
      data,
      km: kmNum,
      segundos,
      tipo,
      sensacao,
      notas,
    };
    startSalvar(async () => {
      if (editandoId) {
        await updateRun(editandoId, payload);
        toast.success("Corrida atualizada");
      } else {
        await createRun(payload);
        toast.success(`Corrida registrada · ${formatPace(pace)}`);
      }
      fechar(false);
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="microlabel">Corridas registradas</p>
        <Button variant="primary" size="sm" onClick={() => abrir(null)}>
          <Plus className="h-4 w-4" strokeWidth={2} />
          Registrar corrida
        </Button>
      </div>

      <div className="mt-4">
        {corridas.length === 0 ? (
          <EmptyState
            icon={Footprints}
            title="Nenhuma corrida registrada ainda."
            className="py-14"
          />
        ) : (
          <Table>
            <THead>
              <Th>Data</Th>
              <Th right>Distância</Th>
              <Th right>Tempo</Th>
              <Th right>Pace</Th>
              <Th>Tipo</Th>
              <Th>Sensação</Th>
              <Th right> </Th>
            </THead>
            <tbody>
              {corridas.map((c) => (
                <Tr key={c.id}>
                  <Td className="tabular text-mist">{c.dataLabel}</Td>
                  <Td right>
                    {c.km.toLocaleString("pt-BR", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 2,
                    })}{" "}
                    km
                  </Td>
                  <Td right className="text-mist">
                    {formatDuracao(c.segundos)}
                  </Td>
                  <Td right>{formatPace(c.segundos / c.km)}</Td>
                  <Td>
                    <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11.5px] text-mist">
                      {c.tipo}
                    </span>
                  </Td>
                  <Td>
                    <span className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span
                          key={n}
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            n <= c.sensacao ? "bg-mint" : "bg-surface-2"
                          )}
                        />
                      ))}
                    </span>
                  </Td>
                  <Td right>
                    <DotsMenu
                      items={[
                        { label: "Editar", icon: Pencil, onSelect: () => abrir(c) },
                        {
                          label: "Excluir",
                          icon: Trash2,
                          destructive: true,
                          onSelect: () =>
                            startTransition(async () => {
                              const removida = await deleteRun(c.id);
                              if (!removida) return;
                              toast("Corrida excluída", {
                                action: {
                                  label: "Desfazer",
                                  onClick: () =>
                                    restoreRun({
                                      data: removida.data,
                                      km: removida.km,
                                      segundos: removida.segundos,
                                      tipo: removida.tipo,
                                      sensacao: removida.sensacao,
                                      notas: removida.notas,
                                    }),
                                },
                              });
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

      <Sheet open={aberto} onOpenChange={fechar}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>{editandoId ? "Editar corrida" : "Nova corrida"}</SheetTitle>
          <div className="mt-6 flex flex-col gap-5">
            <div>
              <Label htmlFor="run-data">Data</Label>
              <Input
                id="run-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="tabular"
              />
            </div>

            <div>
              <Label htmlFor="run-km">Distância (km)</Label>
              <Input
                id="run-km"
                inputMode="decimal"
                value={km}
                onChange={(e) => setKm(e.target.value)}
                placeholder="8,2"
                className="tabular"
              />
            </div>

            <div>
              <Label>Tempo</Label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { v: h, set: setH, ph: "h" },
                  { v: min, set: setMin, ph: "min" },
                  { v: seg, set: setSeg, ph: "s" },
                ].map((campo) => (
                  <Input
                    key={campo.ph}
                    aria-label={campo.ph}
                    inputMode="numeric"
                    value={campo.v}
                    onChange={(e) => campo.set(e.target.value)}
                    placeholder={campo.ph}
                    className="tabular text-center"
                  />
                ))}
              </div>
              {pace > 0 && (
                <p className="tabular mt-2 text-[12.5px] text-mint">
                  Pace {formatPace(pace)}
                </p>
              )}
            </div>

            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Sensação</Label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`Sensação ${n}`}
                    onClick={() => setSensacao(n)}
                    className={cn(
                      "h-6 w-6 rounded-full border transition-colors",
                      n <= sensacao
                        ? "border-transparent bg-mint"
                        : "border-stroke bg-surface-2 hover:border-mint"
                    )}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="run-notas">Notas</Label>
              <Textarea
                id="run-notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="min-h-16"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={salvar}
                disabled={kmNum <= 0 || segundos <= 0 || pending}
              >
                {pending ? "Salvando…" : "Salvar"}
              </Button>
              <Button variant="ghost" onClick={() => fechar(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
