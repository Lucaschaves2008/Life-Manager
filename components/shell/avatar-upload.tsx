"use client";

import { useRef, useState } from "react";
import { useAcao } from "@/lib/acao-cliente";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clearAvatar, updateAvatar } from "@/app/actions/settings";
import { initials } from "@/lib/utils";

export function AvatarUpload({
  nome,
  email,
  avatarUrl,
}: {
  nome: string | null;
  email: string;
  avatarUrl: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [file, setFile] = useState<File | null>(null);
  const [pending, executar] = useAcao();

  function onSelect(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : avatarUrl);
  }

  function salvar() {
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    executar(async () => {
      try {
        await updateAvatar(formData);
        toast.success("Foto atualizada.");
        setFile(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível enviar a imagem.");
      }
    });
  }

  function remover() {
    executar(async () => {
      try {
        await clearAvatar();
        setPreview(null);
        setFile(null);
        toast.success("Foto removida.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível remover a imagem.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-mint-soft text-[18px] font-medium text-mint">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          initials(nome, email)
        )}
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-stroke bg-surface-2/50 px-4 py-5 text-center transition-colors hover:border-mint"
      >
        <Upload className="h-5 w-5 text-steel" strokeWidth={1.5} />
        <span className="text-[13px] text-ice">Escolher arquivo</span>
        <span className="text-[11.5px] text-steel">PNG, JPG ou WEBP até 2 MB</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
      />

      <div className="flex shrink-0 gap-2">
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={pending || !preview}
          onClick={remover}
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          Remover
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={pending || !file}
          onClick={salvar}
        >
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
