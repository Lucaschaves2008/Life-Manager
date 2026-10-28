import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseJSON<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** Iniciais para avatar-placeholder a partir de um nome ou e-mail. */
export function initials(nome: string | null | undefined, email: string): string {
  const base = nome?.trim() || email?.trim() || "";
  const parts = base.split(/[\s@.]+/).filter(Boolean);
  // Sem nome e sem e-mail (ou só separadores) não há inicial: devolver "?" em
  // vez de estourar. Este componente vive no layout raiz — um throw aqui
  // derruba TODA a aplicação, inclusive a página de erro que tentaria mostrá-lo.
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Copia do objeto só as chaves listadas. Entrada de server action é endpoint
 * público: `data: { ...input }` deixaria o cliente gravar QUALQUER coluna —
 * inclusive `userId`, movendo o registro para a conta de outra pessoa.
 * O tipo de `chaves` exige TODA chave de T: campo novo no input sem entrar
 * aqui quebra o build em vez de sumir calado.
 */
export function apenas<T extends object>(obj: T, chaves: { [K in keyof Required<T>]: true }): T {
  const out = {} as T;
  for (const k of Object.keys(chaves) as (keyof T)[]) {
    if (k in obj) out[k] = obj[k];
  }
  return out;
}
