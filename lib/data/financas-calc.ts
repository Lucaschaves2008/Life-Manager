export type TransacaoTipoNatureza = { tipo: string; natureza: string };

/**
 * Uma transação conta nos totais/gráficos de GASTO quando é despesa "de
 * verdade" — nunca um "compromisso" (comprometimento recorrente, ex.: aporte
 * mensal fixo, ver prisma/schema.prisma). Receitas sempre contam.
 * Centraliza a regra que já existia espalhada e incompleta em
 * fluxoDeCaixaDoMes/receitasCard/despesasCard (faltava excluir compromisso).
 */
export function contaNosTotaisDeFluxo(tx: TransacaoTipoNatureza): boolean {
  if (tx.tipo === "receita") return true;
  if (tx.tipo === "despesa") return tx.natureza === "despesa";
  return false;
}
