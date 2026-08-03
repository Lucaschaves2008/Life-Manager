"use client";

import { useEffect, useState, useTransition } from "react";
import { useAcao } from "@/lib/acao-cliente";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
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
import { buscarCorridaStrava } from "@/app/actions/strava";
import {
  MODALIDADE,
  campoDistancia,
  formatDistanciaMod,
  formatDuracao,
  formatRitmo,
  numeroDigitado,
  paraKm,
  type ModalidadeCardio,
} from "@/lib/data/treinos-format";
import { ICONE_MODALIDADE } from "@/components/treinos/plano-cardio-client";
import { cn } from "@/lib/utils";

export type CorridaView = {
  id: string;
  data: string;
  dataLabel: string;
  /** Sempre em km — a exibição converte para a unidade da modalidade. */
  km: number;
  segundos: number;
  tipo: string;
  sensacao: number;
  notas: string | null;
  stravaLink: string | null;
};

/**
 * Registro manual de sessões de cardio. Um componente para as três
 * modalidades: `modalidade` decide unidade, ritmo, tipos e rótulos. O Strava
 * só aparece onde há importação (corrida e ciclismo; natação de piscina não
 * tem GPS e o Strava não devolve distância confiável).
 */
export function CardioClient({
  corridas,
  hoje,
  modalidade,
}: {
  corridas: CorridaView[];
  hoje: string;
  modalidade: ModalidadeCardio;
}) {
  const cfg = MODALIDADE[modalidade];
  const Icone = ICONE_MODALIDADE[modalidade];
  const temStrava = modalidade !== "natacao";

  const router = useRouter();
  const params = useSearchParams();
  const [, executar] = useAcao();
  const [pending, startSalvar] = useTransition();
  const [buscando, startBuscar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [data, setData] = useState(hoje);
  const [distancia, setDistancia] = useState("");
  const [h, setH] = useState("0");
  const [min, setMin] = useState("");
  const [seg, setSeg] = useState("");
  const [tipo, setTipo] = useState(cfg.tipos[0]);
  const [sensacao, setSensacao] = useState(3);
  const [notas, setNotas] = useState("");
  const [stravaLink, setStravaLink] = useState("");
  const [stravaActivityId, setStravaActivityId] = useState<string | null>(null);

  // O deep-link "+ Novo" só deve abrir o formulário da aba que o usuário está
  // vendo — sem o guard, as três abas abririam o sheet ao mesmo tempo.
  const abrirNovo = params.get("novo") === "1" && (params.get("tab") ?? "corrida") === modalidade;
  useEffect(() => {
    if (abrirNovo) setAberto(true);
  }, [abrirNovo]);

  const segundos =
    (Number(h) || 0) * 3600 + (Number(min) || 0) * 60 + (Number(seg) || 0);
  const kmNum = paraKm(numeroDigitado(distancia), modalidade);
  const ritmo = formatRitmo(segundos, kmNum, modalidade);

  function abrir(corrida: CorridaView | null) {
    setEditandoId(corrida?.id ?? null);
    setData(corrida?.data ?? hoje);
    setDistancia(corrida ? campoDistancia(corrida.km, modalidade) : "");
    setH(corrida ? String(Math.floor(corrida.segundos / 3600)) : "0");
    setMin(corrida ? String(Math.floor((corrida.segundos % 3600) / 60)) : "");
    setSeg(corrida ? String(corrida.segundos % 60) : "");
    setTipo(corrida?.tipo ?? cfg.tipos[0]);
    setSensacao(corrida?.sensacao ?? 3);
    setNotas(corrida?.notas ?? "");
    setStravaLink(corrida?.stravaLink ?? "");
    setStravaActivityId(null);
    setAberto(true);
  }

  function buscarDoStrava() {
    const link = stravaLink.trim();
    if (!link) return;
    startBuscar(async () => {
      try {
        const importada = await buscarCorridaStrava(link);
        setData(importada.data);
        setDistancia(campoDistancia(importada.km, modalidade));
        const seg = importada.segundos;
        setH(String(Math.floor(seg / 3600)));
        setMin(String(Math.floor((seg % 3600) / 60)));
        setSeg(String(seg % 60));
        setNotas(importada.nome);
        setStravaLink(importada.link);
        setStravaActivityId(importada.activityId);
        toast.success("Métricas importadas do Strava");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível importar essa atividade.");
      }
    });
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
      modalidade,
      sensacao,
      notas,
      stravaLink: stravaLink.trim() || null,
      stravaActivityId,
    };
    startSalvar(async () => {
      try {
        if (editandoId) {
          await updateRun(editandoId, payload);
          toast.success("Registro atualizado");
        } else {
          await createRun(payload);
          toast.success(`${maiuscula(cfg.atividade)} registrada · ${ritmo}`);
        }
        fechar(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível salvar o registro.");
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="microlabel">{maiuscula(cfg.atividadePlural)} registradas</p>
        <Button variant="primary" size="sm" onClick={() => abrir(null)}>
          <Plus className="h-4 w-4" strokeWidth={2} />
          Registrar {cfg.atividade}
        </Button>
      </div>

      <div className="mt-4">
        {corridas.length === 0 ? (
          <EmptyState
            icon={Icone}
            title={`Nenhuma ${cfg.atividade} registrada ainda`}
            description={`Registre sua primeira ${cfg.atividade} para acompanhar ${cfg.ritmoLabel.toLowerCase()}, volume e recordes.`}
            className="py-14"
          />
        ) : (
          <Table>
            <THead>
              <Th>Data</Th>
              <Th right>Distância</Th>
              <Th right>Tempo</Th>
              <Th right>{cfg.ritmoLabel}</Th>
              <Th>Tipo</Th>
              <Th>Sensação</Th>
              <Th right> </Th>
            </THead>
            <tbody>
              {corridas.map((c) => (
                <Tr key={c.id}>
                  <Td className="tabular text-mist">
                    <span className="flex items-center gap-1.5">
                      {c.dataLabel}
                      {c.stravaLink && (
                        <a
                          href={c.stravaLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Ver no Strava"
                          className="text-steel transition-colors hover:text-mint"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </a>
                      )}
                    </span>
                  </Td>
                  <Td right>{formatDistanciaMod(c.km, modalidade)}</Td>
                  <Td right className="text-mist">
                    {formatDuracao(c.segundos)}
                  </Td>
                  <Td right>{formatRitmo(c.segundos, c.km, modalidade)}</Td>
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
                            executar(async () => {
                              const removida = await deleteRun(c.id);
                              if (!removida) return;
                              toast(`${maiuscula(cfg.atividade)} excluída`, {
                                action: {
                                  label: "Desfazer",
                                  onClick: () =>
                                    restoreRun({
                                      data: removida.data,
                                      km: removida.km,
                                      segundos: removida.segundos,
                                      tipo: removida.tipo,
                                      modalidade: removida.modalidade,
                                      sensacao: removida.sensacao,
                                      notas: removida.notas,
                                      stravaLink: removida.stravaLink,
                                      runSessionId: removida.runSessionId,
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
          <SheetTitle>
            {editandoId ? `Editar ${cfg.atividade}` : `Nova ${cfg.atividade}`}
          </SheetTitle>
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
              <Label htmlFor="run-km">Distância ({cfg.unidade})</Label>
              <Input
                id="run-km"
                inputMode="decimal"
                value={distancia}
                onChange={(e) => setDistancia(e.target.value)}
                placeholder={cfg.placeholderDistancia}
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
              {ritmo !== "—" && (
                <p className="tabular mt-2 text-[12.5px] text-mint">
                  {cfg.ritmoLabel} {ritmo}
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
                  {cfg.tipos.map((t) => (
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

            {temStrava && (
              <div>
                <Label htmlFor="run-strava">Link do Strava</Label>
                <div className="flex gap-2">
                  <Input
                    id="run-strava"
                    value={stravaLink}
                    onChange={(e) => {
                      setStravaLink(e.target.value);
                      setStravaActivityId(null);
                    }}
                    placeholder="https://www.strava.com/activities/…"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!stravaLink.trim() || buscando}
                    onClick={buscarDoStrava}
                  >
                    <Download
                      className={cn("h-4 w-4", buscando && "animate-pulse")}
                      strokeWidth={1.5}
                    />
                    {buscando ? "Buscando…" : "Buscar"}
                  </Button>
                </div>
                {stravaActivityId && (
                  <p className="mt-1.5 text-[12px] text-mint">
                    Métricas importadas do Strava — confira antes de salvar.
                  </p>
                )}
              </div>
            )}

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

/** "corrida" → "Corrida" — os rótulos de MODALIDADE vivem em minúscula. */
function maiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
