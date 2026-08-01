"use client";

import { useRef, useState } from "react";
import { useAcao } from "@/lib/acao-cliente";
import { FileText, Pin, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardLabel } from "@/components/caverna/card";
import { Button } from "@/components/ui/button";
import { enviarDocumento, excluirDocumento } from "@/app/actions/desafios";
import type { DesafioDocumentoView } from "@/lib/data/desafios-documento";
import { cn } from "@/lib/utils";

const TIPOS_ACEITOS = "application/pdf,image/png,image/jpeg";

export function DesafioDocumento({
  desafioId,
  viewerUserId,
  isCriador,
  documentoInicial,
}: {
  desafioId: string;
  viewerUserId: string;
  isCriador: boolean;
  documentoInicial: DesafioDocumentoView | null;
}) {
  const [documento, setDocumento] = useState(documentoInicial);
  const [abrirUpload, setAbrirUpload] = useState(false);
  const [abrirPreview, setAbrirPreview] = useState(false);
  const [nome, setNome] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, executar] = useAcao();
  const inputRef = useRef<HTMLInputElement>(null);

  const podeExcluir = documento && (documento.enviadoPorId === viewerUserId || isCriador);
  const isImagem = documento?.arquivoTipo.startsWith("image/");

  function onSelect(f: File | null) {
    setFile(f);
    if (f && !nome) setNome(f.name.replace(/\.[^.]+$/, ""));
  }

  function enviar() {
    if (!file || !nome.trim()) return;
    const formData = new FormData();
    formData.set("nome", nome.trim());
    formData.set("file", file);
    executar(async () => {
      try {
        await enviarDocumento(desafioId, formData);
        setDocumento({
          id: "temp",
          nome: nome.trim(),
          arquivoUrl: URL.createObjectURL(file),
          arquivoTipo: file.type,
          enviadoPorId: viewerUserId,
          enviadoPorNome: null,
          criadoEm: new Date().toISOString(),
        });
        toast.success("Documento fixado.");
        setAbrirUpload(false);
        setFile(null);
        setNome("");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível enviar o documento.");
      }
    });
  }

  function remover() {
    executar(async () => {
      try {
        await excluirDocumento(desafioId);
        setDocumento(null);
        setAbrirPreview(false);
        toast.success("Documento removido.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível remover o documento.");
      }
    });
  }

  return (
    <>
      <Card>
        <div className="flex items-center justify-between">
          <CardLabel className="flex items-center gap-1.5">
            <Pin className="h-3 w-3" strokeWidth={2} />
            Documento fixado
          </CardLabel>
          {documento && (
            <button
              type="button"
              onClick={() => setAbrirUpload(true)}
              className="text-[11.5px] text-steel transition-colors hover:text-ice"
            >
              Trocar
            </button>
          )}
        </div>

        {documento ? (
          <button
            type="button"
            onClick={() => setAbrirPreview(true)}
            className="mt-3 flex w-full items-center gap-3 rounded-[14px] border border-stroke bg-surface-2/40 px-3 py-2.5 text-left transition-colors hover:border-mist/40"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-mint-soft text-mint">
              <FileText className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-ice">{documento.nome}</p>
              <p className="text-[11px] text-steel">
                {documento.enviadoPorNome ? `Por ${documento.enviadoPorNome}` : "Ver documento"}
              </p>
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAbrirUpload(true)}
            className="mt-3 flex w-full flex-col items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-stroke bg-surface-2/50 px-4 py-5 text-center transition-colors hover:border-mint"
          >
            <Upload className="h-5 w-5 text-steel" strokeWidth={1.5} />
            <span className="text-[13px] text-ice">Fixar um contrato</span>
            <span className="text-[11.5px] text-steel">PDF ou imagem, até 25MB</span>
          </button>
        )}
      </Card>

      {abrirUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setAbrirUpload(false)}>
          <div
            className="w-full max-w-sm rounded-[20px] border border-stroke bg-surface p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-medium text-ice">Fixar documento</p>
              <button type="button" onClick={() => setAbrirUpload(false)} className="text-steel hover:text-ice">
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do documento (ex: Contrato)"
              maxLength={80}
              className="mt-4 h-10 w-full rounded-[12px] border border-stroke bg-surface-2/40 px-3 text-[13px] text-ice placeholder:text-steel focus:border-mist/40 focus:outline-none"
            />

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={cn(
                "mt-3 flex w-full flex-col items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-stroke bg-surface-2/50 px-4 py-5 text-center transition-colors hover:border-mint",
                file && "border-mint/50"
              )}
            >
              <Upload className="h-5 w-5 text-steel" strokeWidth={1.5} />
              <span className="text-[13px] text-ice">{file ? file.name : "Escolher arquivo"}</span>
              <span className="text-[11.5px] text-steel">PDF, JPG ou PNG · até 25MB</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={TIPOS_ACEITOS}
              className="hidden"
              onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
            />

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAbrirUpload(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={pending || !file || !nome.trim()}
                onClick={enviar}
              >
                {pending ? "Enviando…" : "Fixar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {abrirPreview && documento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setAbrirPreview(false)}>
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[20px] border border-stroke bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 pb-3">
              <p className="truncate text-[14px] font-medium text-ice">{documento.nome}</p>
              <div className="flex items-center gap-3 shrink-0">
                {podeExcluir && (
                  <button
                    type="button"
                    onClick={remover}
                    disabled={pending}
                    className="text-steel transition-colors hover:text-red-400"
                    aria-label="Remover documento"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                )}
                <button type="button" onClick={() => setAbrirPreview(false)} className="text-steel hover:text-ice">
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto rounded-[14px] bg-surface-2/40">
              {isImagem ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={documento.arquivoUrl} alt={documento.nome} className="mx-auto max-w-full" />
              ) : (
                <iframe src={documento.arquivoUrl} title={documento.nome} className="h-[75vh] w-full" />
              )}
            </div>
            <div className="flex justify-end pt-3">
              <a
                href={documento.arquivoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-steel underline-offset-2 hover:text-ice hover:underline"
              >
                Abrir em nova aba
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
