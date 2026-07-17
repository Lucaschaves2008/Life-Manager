const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const brlNoSymbol = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formata centavos como "R$ 1.234,56". */
export function formatBRL(centavos: number): string {
  return brl.format(centavos / 100);
}

/** Formata centavos sem o símbolo: "1.234,56". */
export function formatBRLPlain(centavos: number): string {
  return brlNoSymbol.format(centavos / 100);
}

/** Separa em partes para o padrão hero (R$ pequeno · inteiro grande · centavos pequenos). */
export function splitBRL(centavos: number): {
  sinal: string;
  inteiro: string;
  centavos: string;
} {
  const negativo = centavos < 0;
  const abs = Math.abs(centavos);
  const inteiro = Math.floor(abs / 100);
  const cents = abs % 100;
  return {
    sinal: negativo ? "−" : "",
    inteiro: new Intl.NumberFormat("pt-BR").format(inteiro),
    centavos: cents.toString().padStart(2, "0"),
  };
}

/** Formata compacto: "R$ 18,2 mil". */
export function formatBRLCompact(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(centavos / 100);
}

/** Parse de string "1.234,56" ou "1234,56" para centavos. */
export function parseBRL(input: string): number {
  const clean = input.replace(/[^\d,-]/g, "").replace(",", ".");
  const value = parseFloat(clean);
  if (Number.isNaN(value)) return 0;
  return Math.round(value * 100);
}

/** Variação percentual entre dois valores em centavos. */
export function percentDiff(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

/** Formata percentual pt-BR: "+114,2%". */
export function formatPercent(pct: number, signed = true): string {
  const fmt = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const sign = signed && pct > 0 ? "+" : "";
  return `${sign}${fmt.format(pct)}%`;
}
