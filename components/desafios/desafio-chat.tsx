"use client";

import { useEffect, useRef, useState } from "react";
import { useAcao } from "@/lib/acao-cliente";
import { Send } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { Flame } from "@/components/caverna/flame";
import { buscarMensagens, enviarMensagem } from "@/app/actions/desafios";
import type { MensagemView } from "@/lib/data/desafios-chat";
import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

const INTERVALO_POLL_MS = 4000;

function horaCurta(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function DesafioChat({
  desafioId,
  viewerUserId,
  mensagensIniciais,
  streakPorUsuario,
}: {
  desafioId: string;
  viewerUserId: string;
  mensagensIniciais: MensagemView[];
  streakPorUsuario: Map<string, number>;
}) {
  const [mensagens, setMensagens] = useState(mensagensIniciais);
  const [texto, setTexto] = useState("");
  const [pending, executar] = useAcao();
  const listaRef = useRef<HTMLDivElement>(null);
  const ultimoIdRef = useRef<string | null>(mensagensIniciais.at(-1)?.id ?? null);

  useEffect(() => {
    let cancelado = false;
    const intervalo = setInterval(async () => {
      const atualizadas = await buscarMensagens(desafioId);
      if (cancelado) return;
      setMensagens(atualizadas);
    }, INTERVALO_POLL_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [desafioId]);

  useEffect(() => {
    const ultimoId = mensagens.at(-1)?.id ?? null;
    if (ultimoId === ultimoIdRef.current) return;
    ultimoIdRef.current = ultimoId;
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens]);

  function enviar() {
    const limpo = texto.trim();
    if (!limpo || pending) return;
    setTexto("");
    executar(async () => {
      await enviarMensagem(desafioId, limpo);
      const atualizadas = await buscarMensagens(desafioId);
      setMensagens(atualizadas);
    });
  }

  return (
    <Card className="flex flex-col">
      <CardLabel>Conversa</CardLabel>

      <div ref={listaRef} className="mt-3 flex max-h-[360px] min-h-[160px] flex-col gap-3 overflow-y-auto pr-1">
        {mensagens.length === 0 ? (
          <p className="mt-2 text-[13px] text-steel">
            Ainda sem mensagens — chame o grupo pra ação.
          </p>
        ) : (
          mensagens.map((m) => {
            const souEu = m.userId === viewerUserId;
            const streak = streakPorUsuario.get(m.userId) ?? 0;
            return (
              <div key={m.id} className={cn("flex items-end gap-2", souEu && "flex-row-reverse")}>
                <div className="relative shrink-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-[10.5px] text-mist">
                    {initials(m.nome, "?")}
                  </div>
                  {streak > 0 && (
                    <Flame streak={streak} size={14} className="absolute -bottom-1 -right-1" animate={false} />
                  )}
                </div>
                <div className={cn("flex max-w-[75%] flex-col gap-1", souEu && "items-end")}>
                  {!souEu && (
                    <span className="px-1 text-[10.5px] text-steel">{m.nome ?? "Alguém"}</span>
                  )}
                  <div
                    className={cn(
                      "rounded-[14px] px-3 py-2 text-[13px] leading-snug",
                      souEu ? "bg-mint-soft text-paper" : "bg-surface-2 text-mist"
                    )}
                  >
                    {m.texto}
                  </div>
                  <span className="px-1 text-[10px] text-steel">{horaCurta(m.criadoEm)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-stroke pt-3">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          placeholder="Escreva uma mensagem…"
          maxLength={500}
          className="h-9 flex-1 rounded-[12px] border border-stroke bg-surface-2/40 px-3 text-[13px] text-ice placeholder:text-steel focus:border-mist/40 focus:outline-none"
        />
        <button
          aria-label="Enviar mensagem"
          onClick={enviar}
          disabled={!texto.trim() || pending}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-surface-2 text-ice transition-colors hover:bg-surface-2/70 disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </Card>
  );
}
