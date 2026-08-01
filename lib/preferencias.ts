/**
 * Preferências de conta (moeda, fuso, unidades, notificações).
 *
 * Módulo PURO — sem I/O — para poder ser lido no servidor e no cliente.
 * Persistidas na tabela Setting, uma linha por chave.
 *
 * ESTADO ATUAL: a estrutura existe e a escolha é gravada, mas os valores
 * exibidos no app seguem em BRL/kg/km. A conversão de fato depende de trocar
 * os formatadores (lib/money.ts, lib/data/treinos-format.ts) em todos os
 * pontos de exibição — feito à parte, para não arriscar número errado.
 * Mesmo espírito do seletor de tema, que já expõe claro/escuro na UI.
 */

export const PREF_MOEDA = "pref_moeda";
export const PREF_FUSO = "pref_fuso";
export const PREF_UNIDADE_PESO = "pref_unidade_peso";
export const PREF_UNIDADE_DISTANCIA = "pref_unidade_distancia";

export type Moeda = "BRL" | "USD" | "EUR";
export type UnidadePeso = "kg" | "lb";
export type UnidadeDistancia = "km" | "mi";

export const MOEDAS: { value: Moeda; label: string }[] = [
  { value: "BRL", label: "Real (R$)" },
  { value: "USD", label: "Dólar (US$)" },
  { value: "EUR", label: "Euro (€)" },
];

export const UNIDADES_PESO: { value: UnidadePeso; label: string }[] = [
  { value: "kg", label: "Quilogramas (kg)" },
  { value: "lb", label: "Libras (lb)" },
];

export const UNIDADES_DISTANCIA: { value: UnidadeDistancia; label: string }[] = [
  { value: "km", label: "Quilômetros (km)" },
  { value: "mi", label: "Milhas (mi)" },
];

/** Fusos relevantes para o usuário do app (BR + os mais comuns fora). */
export const FUSOS: { value: string; label: string }[] = [
  { value: "America/Sao_Paulo", label: "Brasília (GMT-3)" },
  { value: "America/Manaus", label: "Manaus (GMT-4)" },
  { value: "America/Rio_Branco", label: "Rio Branco (GMT-5)" },
  { value: "America/Noronha", label: "Fernando de Noronha (GMT-2)" },
  { value: "Europe/Lisbon", label: "Lisboa (GMT+0/+1)" },
  { value: "America/New_York", label: "Nova York (GMT-5/-4)" },
];

export const PADRAO = {
  moeda: "BRL" as Moeda,
  fuso: "America/Sao_Paulo",
  peso: "kg" as UnidadePeso,
  distancia: "km" as UnidadeDistancia,
};

/** Lê um valor salvo validando contra as opções conhecidas (cai no padrão). */
export function lerOpcao<T extends string>(
  valor: string | undefined | null,
  opcoes: readonly { value: T }[],
  padrao: T
): T {
  const achado = opcoes.find((o) => o.value === valor);
  return achado ? achado.value : padrao;
}

// ---------- Notificações ----------

export type CanalNotificacao = "email" | "push";

export type TipoNotificacao =
  | "streak_risco"
  | "treino_nao_registrado"
  | "conta_a_vencer"
  | "orcamento_no_limite";

export const TIPOS_NOTIFICACAO: {
  value: TipoNotificacao;
  label: string;
  ajuda: string;
}[] = [
  {
    value: "streak_risco",
    label: "Ofensiva em risco",
    ajuda: "Avisa no fim do dia se você ainda não registrou nada.",
  },
  {
    value: "treino_nao_registrado",
    label: "Treino não registrado",
    ajuda: "Avisa quando um treino agendado passa do horário sem registro.",
  },
  {
    value: "conta_a_vencer",
    label: "Conta a vencer",
    ajuda: "Avisa alguns dias antes do vencimento de faturas e contas.",
  },
  {
    value: "orcamento_no_limite",
    label: "Orçamento perto do limite",
    ajuda: "Avisa ao atingir 80% do orçamento de uma categoria.",
  },
];

export function chaveNotificacao(
  tipo: TipoNotificacao,
  canal: CanalNotificacao
): string {
  return `notif_${tipo}_${canal}`;
}

/** Notificação desligada por padrão: só liga com "on" explícito. */
export function notificacaoAtiva(valor: string | undefined | null): boolean {
  return valor === "on";
}
