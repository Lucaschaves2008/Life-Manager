export type Movimento = {
  id: string;
  tipo: string;
  valor: number;
  data: Date;
  nota: string | null;
};

/**
 * Valor de um ativo numa data: caminha os movimentos em ordem cronológica.
 * aporte e dividendo somam, resgate subtrai, atualizacao DEFINE o valor total.
 */
export function valorEm(movs: Movimento[], ate: Date): number {
  let valor = 0;
  for (const m of movs) {
    if (m.data > ate) break;
    if (m.tipo === "aporte" || m.tipo === "dividendo") valor += m.valor;
    else if (m.tipo === "resgate") valor -= m.valor;
    else if (m.tipo === "atualizacao") valor = m.valor;
  }
  return Math.max(0, valor);
}

/**
 * Aportes − resgates até a data (dinheiro do próprio bolso).
 * Dividendos NÃO entram: são rendimento, não capital investido.
 */
export function aportadoEm(movs: Movimento[], ate: Date): number {
  let total = 0;
  for (const m of movs) {
    if (m.data > ate) break;
    if (m.tipo === "aporte") total += m.valor;
    else if (m.tipo === "resgate") total -= m.valor;
  }
  return total;
}

/** Soma dos dividendos recebidos até a data. */
export function dividendosEm(movs: Movimento[], ate: Date): number {
  let total = 0;
  for (const m of movs) {
    if (m.data > ate) break;
    if (m.tipo === "dividendo") total += m.valor;
  }
  return total;
}
