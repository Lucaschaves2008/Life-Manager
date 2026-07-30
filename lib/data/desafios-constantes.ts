/**
 * Constantes e tipos puros de desafios (sem I/O), separados de desafios.ts
 * para poderem ser importados por Client Components sem arrastar
 * dependências server-only (mesmo motivo de metas-quantitativas-constantes.ts).
 */

export type DesafioPeriodo = "semana" | "mes" | "trimestre" | "semestre";
export type DesafioOrigem = "metrica" | "checklist" | "variavel";

export const PERIODOS_DESAFIO: { value: DesafioPeriodo; label: string }[] = [
  { value: "semana", label: "Semanal" },
  { value: "mes", label: "Mensal" },
  { value: "trimestre", label: "Trimestral" },
  { value: "semestre", label: "Semestral" },
];
