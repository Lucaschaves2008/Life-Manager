// Formatadores puros de treinos, em arquivo próprio (client-safe): os client
// components importam daqui sem puxar o grafo server de lib/data/treinos.ts
// ("use cache" + cache-tags/server-only não podem entrar no bundle do cliente).

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

// ---------- Semanas / dias (periodização) ----------

export type WeekOverride = {
  semana: number;
  series: number;
  repsAlvo: string;
  cargaAtual: number;
};

export type WeekConfig = {
  series: number;
  repsAlvo: string;
  cargaAtual: number;
  /** true = valor herdado de uma semana anterior (não editado nesta semana). */
  herdado: boolean;
  /** semana de onde veio o valor efetivo (1 = base). */
  origem: number;
};

/**
 * Config efetiva de um exercício na semana N (regra "repete até editar"):
 * pega o override da MAIOR semana <= N que existir; senão a config base
 * (semana 1). `base`/`overrides` são dados puros — sem I/O.
 */
export function weekConfig(
  base: { series: number; repsAlvo: string; cargaAtual: number },
  overrides: WeekOverride[],
  semana: number
): WeekConfig {
  const alvo = Math.max(1, Math.floor(semana) || 1);
  const anterior = overrides
    .filter((w) => w.semana <= alvo)
    .sort((a, b) => b.semana - a.semana)[0];

  if (!anterior) {
    return { ...base, herdado: alvo > 1, origem: 1 };
  }
  return {
    series: anterior.series,
    repsAlvo: anterior.repsAlvo,
    cargaAtual: anterior.cargaAtual,
    herdado: anterior.semana < alvo,
    origem: anterior.semana,
  };
}

export type KmWeek = {
  /** km-alvo efetivo da semana N. */
  kmAlvo: number;
  /** true = valor herdado de uma semana anterior (não editado nesta semana). */
  herdado: boolean;
  /** semana de onde veio o valor efetivo (1 = base). */
  origem: number;
};

/**
 * Km-alvo efetivo de uma sessão de corrida na semana N (mesma regra "repete
 * até editar" de weekConfig, mas para um único float). `base` é o km da
 * semana-1; `overrides` são os RunSessionWeek. Puro — sem I/O.
 */
export function kmDaSemana(
  base: number,
  overrides: { semana: number; kmAlvo: number }[],
  semana: number
): KmWeek {
  const alvo = Math.max(1, Math.floor(semana) || 1);
  const anterior = overrides
    .filter((w) => w.semana <= alvo)
    .sort((a, b) => b.semana - a.semana)[0];

  if (!anterior) {
    return { kmAlvo: base, herdado: alvo > 1, origem: 1 };
  }
  return {
    kmAlvo: anterior.kmAlvo,
    herdado: anterior.semana < alvo,
    origem: anterior.semana,
  };
}

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
  kmAlvoBase: number; // km da semana-1
  kmAlvoSemana: number; // km efetivo da semana do ciclo atual
  herdado: boolean; // km herdado de uma semana anterior
  origemSemana: number;
  cumprida: { id: string; km: number; segundos: number } | null;
  overrides: { semana: number; kmAlvo: number }[]; // p/ o editor de progressão
};

export type PlanoCorridaView = {
  id: string;
  nome: string;
  foco: string | null;
  diasSemana: number[];
  sessoes: SessaoCorridaView[];
};

/** Sessões de corrida (achatadas) para o seletor de vínculo do checklist. */
export type SessaoCorridaOpcao = {
  id: string;
  nome: string;
  tipo: string;
  planoNome: string;
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
