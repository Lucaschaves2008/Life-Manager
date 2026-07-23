// Formatadores puros de estudos — sem imports de servidor, para poderem ser
// usados em client components (estudos.ts tem "use cache"/cache-tags).

/** 3725 → "1h 02min" ; 125 → "2min" ; 0 → "0min" */
export function formatHoras(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.round((segundos % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  return `${m}min`;
}

/** horas decimais → "5,4 h" */
export function formatHorasDecimal(horas: number): string {
  return `${horas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
}
