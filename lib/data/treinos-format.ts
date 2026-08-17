// Formatadores puros de treinos, em arquivo próprio (client-safe): os client
// components importam daqui sem puxar o grafo server de lib/data/treinos.ts
// ("use cache" + cache-tags/server-only não podem entrar no bundle do cliente).

// ---------- Modalidades de cardio ----------
// Corrida, natação e ciclismo compartilham TODA a estrutura (Run/RunRoutine/
// RunSession/RunSessionWeek, planos com periodização, auto-check do checklist,
// métricas). O que muda entre elas é só apresentação: unidade de distância,
// como se chama o ritmo e quais tipos de sessão existem. Este mapa é a fonte
// única dessas diferenças — nenhuma outra parte do app deve ter `if (natacao)`.
//
// IMPORTANTE: a distância é sempre ARMAZENADA em km (Run.km, RunSession.kmAlvo),
// inclusive na natação. `fator` converte km → unidade de exibição na entrada e
// na saída, então 1500 m viram 1.5 no banco e voltam como "1.500 m" na tela.

export const MODALIDADES_CARDIO = ["corrida", "natacao", "ciclismo"] as const;
export type ModalidadeCardio = (typeof MODALIDADES_CARDIO)[number];

export type ModalidadeMeta = {
  value: ModalidadeCardio;
  /** "Corrida" — nome da modalidade (aba, título) */
  label: string;
  /** "corrida" / "natação" / "pedalada" — nome de UMA sessão realizada */
  atividade: string;
  /** "corridas" / "natações" / "pedaladas" */
  atividadePlural: string;
  emoji: string;
  /** Unidade exibida ao usuário. Natação usa metros; as outras, km. */
  unidade: "km" | "m";
  /** km armazenado × fator = valor na unidade exibida */
  fator: 1 | 1000;
  /** Casas decimais na unidade exibida */
  casas: number;
  /** Label do ritmo ("Pace", "Ritmo", "Velocidade média") */
  ritmoLabel: string;
  /** Sufixo do ritmo ("/km", "/100m", "km/h") */
  ritmoSufixo: string;
  /** Tipos de sessão disponíveis no plano e no registro */
  tipos: string[];
  /** Distâncias-referência p/ recordes projetados, na unidade EXIBIDA */
  recordes: [number, number];
  /** Cor de acento da modalidade nos gráficos/cards */
  acento: string;
  /** Placeholder do campo de distância */
  placeholderDistancia: string;
  /** Meta mensal de distância: chave do Setting e valor-padrão (unid. exibida) */
  metaKey: string;
  metaPadrao: number;
};

export const MODALIDADE: Record<ModalidadeCardio, ModalidadeMeta> = {
  corrida: {
    value: "corrida",
    label: "Corrida",
    atividade: "corrida",
    atividadePlural: "corridas",
    emoji: "🏃",
    unidade: "km",
    fator: 1,
    casas: 2,
    ritmoLabel: "Pace",
    ritmoSufixo: "/km",
    tipos: ["Leve", "Moderado", "Intervalado", "Longão"],
    recordes: [5, 10],
    acento: "var(--cal-teal)",
    placeholderDistancia: "8,2",
    metaKey: "meta_km_mes",
    metaPadrao: 40,
  },
  natacao: {
    value: "natacao",
    label: "Natação",
    atividade: "natação",
    atividadePlural: "natações",
    emoji: "🏊",
    unidade: "m",
    fator: 1000,
    casas: 0,
    ritmoLabel: "Ritmo",
    ritmoSufixo: "/100m",
    tipos: ["Leve", "Técnico", "Intervalado", "Longo"],
    recordes: [400, 1500],
    acento: "var(--cal-blue)",
    placeholderDistancia: "1500",
    metaKey: "meta_metros_mes_natacao",
    metaPadrao: 12000,
  },
  ciclismo: {
    value: "ciclismo",
    label: "Ciclismo",
    atividade: "pedalada",
    atividadePlural: "pedaladas",
    emoji: "🚴",
    unidade: "km",
    fator: 1,
    casas: 1,
    ritmoLabel: "Velocidade média",
    ritmoSufixo: "km/h",
    tipos: ["Leve", "Ritmo", "Intervalado", "Longão"],
    recordes: [20, 40],
    acento: "var(--cal-amber)",
    placeholderDistancia: "32",
    metaKey: "meta_km_mes_ciclismo",
    metaPadrao: 150,
  },
};

/** Modalidade válida a partir de string livre (banco/URL); default "corrida". */
export function modalidadeDe(valor: string | null | undefined): ModalidadeCardio {
  return MODALIDADES_CARDIO.includes(valor as ModalidadeCardio)
    ? (valor as ModalidadeCardio)
    : "corrida";
}

/** km armazenado → número na unidade exibida da modalidade (1.5 km → 1500 m). */
export function paraUnidade(km: number, modalidade: ModalidadeCardio): number {
  return km * MODALIDADE[modalidade].fator;
}

/** Valor digitado na unidade exibida → km para gravar (1500 m → 1.5 km). */
export function paraKm(valor: number, modalidade: ModalidadeCardio): number {
  return valor / MODALIDADE[modalidade].fator;
}

/** Texto digitado num campo numérico (aceita vírgula) → number. "" vira 0. */
export function numeroDigitado(texto: string): number {
  return Number(texto.replace(",", ".").trim()) || 0;
}

/**
 * km armazenado → texto EDITÁVEL na unidade da modalidade ("1500", "8,2").
 * Sem separador de milhar de propósito: o valor volta para um <input>, e
 * "1.500" seria relido como 1,5 por numeroDigitado.
 */
export function campoDistancia(km: number, modalidade: ModalidadeCardio): string {
  if (!isFinite(km) || km <= 0) return "";
  const valor = paraUnidade(km, modalidade);
  const casas = MODALIDADE[modalidade].casas;
  const texto = casas === 0 ? String(Math.round(valor)) : String(Number(valor.toFixed(casas)));
  return texto.replace(".", ",");
}

/** Distância na unidade da modalidade: "8,20 km", "1.500 m", "32,4 km". */
export function formatDistanciaMod(km: number, modalidade: ModalidadeCardio): string {
  const m = MODALIDADE[modalidade];
  if (!isFinite(km)) return "—";
  const valor = paraUnidade(km, modalidade);
  // Acima de 100 na unidade exibida uma casa já basta (mesma regra de formatDistancia)
  const casas = m.casas > 1 && Math.abs(valor) >= 100 ? 1 : m.casas;
  return `${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })} ${m.unidade}`;
}

/**
 * Ritmo da modalidade a partir de tempo e distância brutos:
 * corrida "5′32″/km", natação "1′48″/100m", ciclismo "28,4 km/h".
 */
export function formatRitmo(
  segundos: number,
  km: number,
  modalidade: ModalidadeCardio
): string {
  if (!isFinite(segundos) || !isFinite(km) || segundos <= 0 || km <= 0) return "—";
  if (modalidade === "ciclismo") {
    const kmh = km / (segundos / 3600);
    return `${kmh.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} km/h`;
  }
  // corrida: seg por km; natação: seg por 100 m (= km*10 blocos de 100 m)
  const blocos = modalidade === "natacao" ? km * 10 : km;
  const porBloco = segundos / blocos;
  const min = Math.floor(porBloco / 60);
  const seg = Math.round(porBloco % 60);
  return `${min}′${String(seg).padStart(2, "0")}″${MODALIDADE[modalidade].ritmoSufixo}`;
}

/**
 * Valor bruto do ritmo, para gráficos (eixo Y). Corrida/natação devolvem
 * segundos (menor = melhor); ciclismo devolve km/h (maior = melhor).
 */
export function ritmoBruto(
  segundos: number,
  km: number,
  modalidade: ModalidadeCardio
): number {
  if (segundos <= 0 || km <= 0) return 0;
  if (modalidade === "ciclismo") return km / (segundos / 3600);
  return segundos / (modalidade === "natacao" ? km * 10 : km);
}

/** Formata um valor já bruto de ritmo (o que ritmoBruto devolveu). */
export function formatRitmoBruto(valor: number, modalidade: ModalidadeCardio): string {
  if (!isFinite(valor) || valor <= 0) return "—";
  if (modalidade === "ciclismo") {
    return `${valor.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} km/h`;
  }
  const min = Math.floor(valor / 60);
  const seg = Math.round(valor % 60);
  return `${min}′${String(seg).padStart(2, "0")}″${MODALIDADE[modalidade].ritmoSufixo}`;
}

/** Formata segundos como pace "5′32″/km" (primes tipográficos, segundos sempre 2 dígitos). */
export function formatPace(segundosPorKm: number): string {
  if (!isFinite(segundosPorKm) || segundosPorKm <= 0) return "—";
  const min = Math.floor(segundosPorKm / 60);
  const seg = Math.round(segundosPorKm % 60);
  return `${min}′${String(seg).padStart(2, "0")}″/km`;
}

/** Formata km: 2 casas abaixo de 100, 1 casa a partir de 100. "8,42 km" / "142,3 km". */
export function formatDistancia(km: number): string {
  if (!isFinite(km)) return "—";
  const casas = Math.abs(km) < 100 ? 2 : 1;
  return `${km.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })} km`;
}

/** Formata carga em kg com 1 casa fixa — meia placa (1,25kg) não pode ser truncada. */
export function formatCarga(kg: number): string {
  if (!isFinite(kg)) return "—";
  return `${kg.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} kg`;
}

/** Formata segundos como h:mm:ss (ou mm:ss). */
export function formatDuracao(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/** Tonelagem em toneladas com 1 casa: "8,2 t". */
export function formatTonelagem(kg: number): string {
  return `${(kg / 1000).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} t`;
}

// ---------- Semanas / dias ----------
// Cada semana do ciclo é independente: RoutineExercise/RunSession têm um
// campo `semana` próprio, e uma lista pertence à sua semana sem herdar nada
// de outra. Ver `semanaCicloAtual`/`setSemanaAtual` (Setting compartilhado)
// pra qual semana está ativa.

/**
 * Km REALIZADOS numa janela (soma de Run.km com data dentro do intervalo).
 *
 * Fonte única para "quantos km eu corri nessa semana": tanto o card-resumo de
 * /treinos (resumoTreinos.kmSemana) quanto a barra da semana atual do gráfico
 * de volume (volumeSemanal) passam por aqui. Antes eram dois reduces
 * independentes sobre a mesma tabela — davam o mesmo número por coincidência,
 * e um filtro adicionado em um dos lados não chegaria no outro. Puro — sem I/O.
 */
export function somarKmNoPeriodo(
  corridas: { data: Date; km: number }[],
  inicio: Date,
  fim: Date
): number {
  return corridas
    .filter((c) => c.data >= inicio && c.data <= fim)
    .reduce((soma, c) => soma + c.km, 0);
}

// ---------- Planos de corrida (tipos puros — client-safe) ----------
// Movidos de treinos.ts (que tem "use cache"/server-only) para cá: client
// components que só precisam do shape do dado importam daqui, sem puxar o
// grafo server no bundle do cliente.

export type SessaoCorridaView = {
  id: string;
  nome: string;
  tipo: string;
  kmAlvo: number;
  semana: number;
  cumprida: { id: string; km: number; segundos: number } | null;
};

export type PlanoCorridaView = {
  id: string;
  nome: string;
  foco: string | null;
  modalidade: ModalidadeCardio;
  diasSemana: number[];
  /** Semanas que já têm pelo menos uma sessão cadastrada — pro seletor de semana. */
  semanasComConteudo: number[];
  sessoes: SessaoCorridaView[];
};

/** Sessões de cardio (achatadas) para o seletor de vínculo do checklist. */
export type SessaoCorridaOpcao = {
  id: string;
  nome: string;
  tipo: string;
  planoNome: string;
  modalidade: ModalidadeCardio;
};

const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** ["1","3"] → "Seg · Qua". Vazio → "Sem dias definidos". */
export function formatDiasSemana(dias: number[]): string {
  if (dias.length === 0) return "Sem dias definidos";
  return dias
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DIAS_CURTOS[d])
    .join(" · ");
}

export const DIAS_SEMANA_LABEL = DIAS_CURTOS;
