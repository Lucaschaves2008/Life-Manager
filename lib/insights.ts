import { formatBRL, formatPercent } from "@/lib/money";

/**
 * Motor de insights — funções puras, sem IA.
 * Cada regra recebe dados pré-agregados e devolve um Insight ou null.
 * A severidade define a cor do headline: info=menta, atencao=âmbar, alerta=coral.
 */

export type Severidade = "info" | "atencao" | "alerta";

export type Insight = {
  id: string;
  headline: string;
  paragrafo: string;
  severidade: Severidade;
  modulo: "financas" | "investimentos" | "treinos" | "dieta";
  peso: number; // desempate: maior = mais relevante
};

const NOME = "Lucas";

// ---------- Finanças ----------

export function insightCategoriaDisparou(input: {
  categoria: string;
  emoji: string;
  atual: number; // centavos no mês atual
  anterior: number; // centavos no mês anterior
  mes: string; // "julho"
}): Insight | null {
  if (input.anterior <= 0 || input.atual <= 0) return null;
  const pct = ((input.atual - input.anterior) / input.anterior) * 100;
  if (pct < 40) return null;
  const severidade: Severidade = pct >= 80 ? "alerta" : "atencao";
  return {
    id: "categoria-disparou",
    headline:
      pct >= 100
        ? "Uma categoria dobrou de tamanho."
        : "Tem uma categoria fugindo do controle.",
    paragrafo: `${NOME}, notei que ${input.emoji} ${input.categoria} disparou ${formatPercent(pct, false)} em relação ao mês passado — de ${formatBRL(input.anterior)} para ${formatBRL(input.atual)} — e tá comendo uma boa parte do seu orçamento de ${input.mes}.`,
    severidade,
    modulo: "financas",
    peso: Math.min(pct, 300),
  };
}

export function insightRitmoDeGastos(input: {
  acumuladoAtual: number; // centavos até o dia de hoje
  acumuladoAnteriorMesmoDia: number; // centavos até o mesmo dia do mês passado
  mes: string;
}): Insight | null {
  const { acumuladoAtual, acumuladoAnteriorMesmoDia } = input;
  if (acumuladoAnteriorMesmoDia <= 0) return null;
  const pct =
    ((acumuladoAtual - acumuladoAnteriorMesmoDia) / acumuladoAnteriorMesmoDia) *
    100;
  if (pct < 15) return null;
  return {
    id: "ritmo-gastos",
    headline: "Você e seu dinheiro precisam de um momento.",
    paragrafo: `${NOME}, seu gasto acumulado em ${input.mes} já está ${formatPercent(pct, false)} acima do ritmo do mês passado nesta mesma altura (${formatBRL(acumuladoAtual)} contra ${formatBRL(acumuladoAnteriorMesmoDia)}). Vale segurar o pé até a virada.`,
    severidade: pct >= 50 ? "alerta" : "atencao",
    modulo: "financas",
    peso: Math.min(pct, 200),
  };
}

export function insightAssinatura(input: {
  nome: string;
  valor: number;
  valorAnterior: number | null;
  novaNoMes: boolean;
  totalMensalAssinaturas: number;
  qtdAssinaturas: number;
}): Insight | null {
  if (input.valorAnterior && input.valor > input.valorAnterior) {
    const pct =
      ((input.valor - input.valorAnterior) / input.valorAnterior) * 100;
    return {
      id: "assinatura-aumentou",
      headline: `${input.nome} ficou mais cara.`,
      paragrafo: `${NOME}, a assinatura ${input.nome} subiu de ${formatBRL(input.valorAnterior)} para ${formatBRL(input.valor)} (${formatPercent(pct, false)}). No total você paga ${formatBRL(input.totalMensalAssinaturas)}/mês em ${input.qtdAssinaturas} assinaturas.`,
      severidade: "atencao",
      modulo: "financas",
      peso: 60,
    };
  }
  if (input.novaNoMes) {
    return {
      id: "assinatura-nova",
      headline: "Assinatura nova na conta.",
      paragrafo: `${NOME}, ${input.nome} entrou na sua lista de assinaturas por ${formatBRL(input.valor)}/mês. Seu total recorrente agora é ${formatBRL(input.totalMensalAssinaturas)}/mês em ${input.qtdAssinaturas} assinaturas.`,
      severidade: "info",
      modulo: "financas",
      peso: 40,
    };
  }
  return null;
}

// ---------- Investimentos ----------

export function insightMelhorMesAporte(input: {
  mesAtualAportes: number; // centavos
  recordeAnterior: number; // centavos (melhor mês antes deste)
  mes: string;
}): Insight | null {
  if (
    input.mesAtualAportes <= 0 ||
    input.mesAtualAportes <= input.recordeAnterior
  )
    return null;
  return {
    id: "melhor-mes-aporte",
    headline: "Seu melhor mês de aportes até agora.",
    paragrafo: `${NOME}, você já aportou ${formatBRL(input.mesAtualAportes)} em ${input.mes} — o seu recorde até então era ${formatBRL(input.recordeAnterior)}. Constância é exatamente isso.`,
    severidade: "info",
    modulo: "investimentos",
    peso: 70,
  };
}

export function insightRendimentoMes(input: {
  rendimentoMes: number; // centavos
  pct: number;
}): Insight | null {
  if (input.rendimentoMes <= 0) return null;
  return {
    id: "rendimento-mes",
    headline: "Seu dinheiro trabalhou este mês.",
    paragrafo: `${NOME}, sua carteira rendeu ${formatBRL(input.rendimentoMes)} este mês (${formatPercent(input.pct)}). Deixa o tempo fazer o resto.`,
    severidade: "info",
    modulo: "investimentos",
    peso: 30,
  };
}

// ---------- Treinos ----------

export function insightStreakTreino(input: {
  streakAtual: number; // dias/semanas consecutivas cumprindo
  recordeAnterior: number;
}): Insight | null {
  if (input.streakAtual <= 2 || input.streakAtual <= input.recordeAnterior)
    return null;
  return {
    id: "streak-recorde",
    headline: "Streak recorde. O modo LC tá pago.",
    paragrafo: `${NOME}, você está há ${input.streakAtual} dias seguidos cumprindo o mínimo — seu recorde anterior era ${input.recordeAnterior}. Não quebra a corrente hoje.`,
    severidade: "info",
    modulo: "treinos",
    peso: 80,
  };
}

// ---------- Dieta ----------

export function insightKcalForaDaMeta(input: {
  mediaKcal7d: number;
  metaKcal: number;
}): Insight | null {
  if (input.metaKcal <= 0 || input.mediaKcal7d <= 0) return null;
  const desvio = ((input.mediaKcal7d - input.metaKcal) / input.metaKcal) * 100;
  if (Math.abs(desvio) < 10) return null;
  const acima = desvio > 0;
  return {
    id: "kcal-fora-meta",
    headline: acima
      ? "As calorias andaram passando do ponto."
      : "Você está comendo menos que o planejado.",
    paragrafo: `${NOME}, sua média dos últimos 7 dias foi ${Math.round(input.mediaKcal7d)} kcal — ${formatPercent(Math.abs(desvio), false)} ${acima ? "acima" : "abaixo"} da sua meta de ${input.metaKcal} kcal. ${acima ? "Ajusta as próximas refeições pra voltar pro trilho." : "Se a fome apertar, não é fraqueza: é matemática."}`,
    severidade: Math.abs(desvio) >= 20 ? "atencao" : "info",
    modulo: "dieta",
    peso: Math.min(Math.abs(desvio), 100),
  };
}

// ---------- Seleção ----------

const ORDEM_SEVERIDADE: Record<Severidade, number> = {
  alerta: 3,
  atencao: 2,
  info: 1,
};

/** Escolhe o insight mais relevante (severidade > peso). */
export function pickInsight(insights: (Insight | null)[]): Insight | null {
  const valid = insights.filter((i): i is Insight => i !== null);
  if (valid.length === 0) return null;
  return valid.sort(
    (a, b) =>
      ORDEM_SEVERIDADE[b.severidade] - ORDEM_SEVERIDADE[a.severidade] ||
      b.peso - a.peso
  )[0];
}

/** Fallback quando nenhum insight dispara. */
export function insightFallback(gastoMes: number, mes: string): Insight {
  return {
    id: "tudo-em-ordem",
    headline: "Tudo sob controle por aqui.",
    paragrafo: `${NOME}, seus gastos de ${mes} somam ${formatBRL(gastoMes)} e nenhuma categoria saiu da linha até agora. Segue o jogo.`,
    severidade: "info",
    modulo: "financas",
    peso: 0,
  };
}
