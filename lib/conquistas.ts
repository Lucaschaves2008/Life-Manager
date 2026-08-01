/**
 * Conquistas: eventos comemoráveis disparados quando o usuário fecha algo
 * (meta batida, checklist 100%, streak subindo de patamar, dieta cumprida).
 *
 * Módulo PURO — sem I/O, sem "use client"/"server-only" — para poder ser
 * usado no servidor (detecção) e no cliente (exibição do toast), e testado
 * sem mockar banco.
 *
 * O feedback é deliberadamente leve (toast, nunca modal bloqueante): ele
 * marca o momento sem interromper o fluxo de quem está registrando as coisas.
 */

export type ConquistaTipo =
  | "meta_batida"
  | "checklist_completo"
  | "streak_marco"
  | "dieta_completa";

export type Conquista = {
  tipo: ConquistaTipo;
  /** Título curto do toast. */
  titulo: string;
  /** Uma linha de contexto — o que exatamente foi conquistado. */
  detalhe: string;
  /**
   * Chave estável do evento no dia (ex.: "meta_batida:abc123:2026-07-31").
   * Usada para não repetir a mesma comemoração a cada re-render/navegação.
   */
  chave: string;
};

/** Marcos de streak que merecem comemoração distinta (dias). */
export const MARCOS_STREAK = [7, 30, 100, 365] as const;

/**
 * Marco atingido ao passar de `anterior` para `atual` dias de ofensiva.
 * Retorna null quando nenhum marco foi cruzado nessa transição — só comemora
 * na virada, nunca enquanto o streak apenas se mantém acima do marco.
 */
export function marcoDeStreakAtingido(
  anterior: number,
  atual: number
): number | null {
  if (atual <= anterior) return null;
  const cruzados = MARCOS_STREAK.filter((m) => anterior < m && atual >= m);
  return cruzados.length > 0 ? Math.max(...cruzados) : null;
}

export function conquistaMetaBatida(
  metaId: string,
  titulo: string,
  dia: string
): Conquista {
  return {
    tipo: "meta_batida",
    titulo: "Meta batida",
    detalhe: titulo,
    chave: `meta_batida:${metaId}:${dia}`,
  };
}

export function conquistaChecklistCompleto(dia: string, total: number): Conquista {
  return {
    tipo: "checklist_completo",
    titulo: "Dia fechado",
    detalhe:
      total === 1
        ? "Você cumpriu o único item do checklist de hoje."
        : `Você cumpriu os ${total} itens do checklist de hoje.`,
    chave: `checklist_completo:${dia}`,
  };
}

export function conquistaDietaCompleta(dia: string): Conquista {
  return {
    tipo: "dieta_completa",
    titulo: "Dieta em dia",
    detalhe: "Todas as refeições do plano foram cumpridas hoje.",
    chave: `dieta_completa:${dia}`,
  };
}

export function conquistaStreakMarco(marco: number, dia: string): Conquista {
  return {
    tipo: "streak_marco",
    titulo: `${marco} dias seguidos`,
    detalhe:
      marco >= 365
        ? "Um ano de constância. Isso é raro."
        : marco >= 100
          ? "Cem dias. A constância virou hábito."
          : marco >= 30
            ? "Um mês inteiro sem quebrar a sequência."
            : "Uma semana de ofensiva. Siga assim.",
    chave: `streak_marco:${marco}:${dia}`,
  };
}

/** Chave da preferência de usuário (tabela Setting). */
export const PREF_CONQUISTAS = "conquistas_feedback";

/** Feedback ligado por padrão; só desliga com o valor explícito "off". */
export function feedbackHabilitado(valor: string | undefined | null): boolean {
  return valor !== "off";
}
