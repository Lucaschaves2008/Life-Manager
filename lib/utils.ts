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
