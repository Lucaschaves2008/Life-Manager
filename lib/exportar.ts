/**
 * Serialização dos dados do usuário para exportação (CSV/JSON).
 * Módulo PURO — sem I/O — para ser testável sem banco.
 */

/** Escapa um campo para CSV (RFC 4180): aspas dobradas e campo entre aspas. */
export function campoCSV(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor.toISOString();
  const texto = String(valor);
  // Aspas, vírgula, ; e quebras de linha exigem envelopar. Também envelopamos
  // quando há espaço nas pontas, que planilhas costumam comer.
  if (/["\n\r,;]/.test(texto) || texto !== texto.trim()) {
    return `"${texto.replaceAll('"', '""')}"`;
  }
  return texto;
}

/**
 * Converte uma lista de objetos em CSV. As colunas saem na ordem de `colunas`
 * (ou das chaves do 1º item). Lista vazia vira só o cabeçalho, quando há
 * colunas declaradas — nunca uma string vazia sem contexto.
 */
export function paraCSV<T extends Record<string, unknown>>(
  linhas: T[],
  colunas?: string[]
): string {
  const cols = colunas ?? (linhas[0] ? Object.keys(linhas[0]) : []);
  if (cols.length === 0) return "";
  const cabecalho = cols.map(campoCSV).join(",");
  const corpo = linhas.map((l) => cols.map((c) => campoCSV(l[c])).join(","));
  return [cabecalho, ...corpo].join("\n");
}

/** Nome de arquivo estável e sem surpresa: mylife-<conjunto>-<AAAA-MM-DD>.<ext> */
export function nomeArquivo(conjunto: string, dia: string, ext: "csv" | "json"): string {
  const limpo = conjunto.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  return `mylife-${limpo}-${dia}.${ext}`;
}
