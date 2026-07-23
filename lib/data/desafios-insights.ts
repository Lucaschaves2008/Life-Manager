import type { MembroDesafio } from "@/lib/data/desafios";

/**
 * Feed de insights do desafio — comparações automáticas entre membros, estilo
 * Gymrats ("Lucas está 20% à frente de você em Treino"). Puramente derivado
 * do progresso já calculado (sem chamada a LLM, sem persistência): recalculado
 * a cada carregamento da página, igual ao resto do progresso do módulo.
 */

const LIMIAR_LIDERANCA_PP = 15; // diferença mínima de pontos percentuais pra virar insight

export type InsightView = {
  id: string;
  tipo: "lideranca" | "concluida";
  texto: string;
};

function nomeOu(nome: string | null, fallback: string): string {
  return nome?.trim() || fallback;
}

export function gerarInsights(membros: MembroDesafio[], agora: Date): InsightView[] {
  const insights: InsightView[] = [];
  const stamp = agora.getTime();

  const maxSlots = Math.max(0, ...membros.map((m) => m.metasGrandes.length));

  for (let slot = 0; slot < maxSlots; slot++) {
    const participantes = membros
      .map((m) => ({ membro: m, meta: m.metasGrandes[slot] }))
      .filter((p) => p.meta !== undefined)
      .sort((a, b) => b.meta.pct - a.meta.pct);

    if (participantes.length === 0) continue;

    const lider = participantes[0];
    if (lider.meta.pct >= 100) {
      insights.push({
        id: `concluida-${stamp}-${slot}-${lider.membro.userId}`,
        tipo: "concluida",
        texto: `${nomeOu(lider.membro.nome, "Alguém")} concluiu "${lider.meta.titulo}" 🎯`,
      });
    }

    if (participantes.length < 2) continue;

    for (const outro of participantes.slice(1)) {
      const diff = lider.meta.pct - outro.meta.pct;
      if (diff < LIMIAR_LIDERANCA_PP) continue;

      insights.push({
        id: `lideranca-${stamp}-${slot}-${lider.membro.userId}-${outro.membro.userId}`,
        tipo: "lideranca",
        texto: `${nomeOu(lider.membro.nome, "Alguém")} está ${Math.round(diff)}% à frente de ${nomeOu(
          outro.membro.nome,
          "você"
        )} em "${lider.meta.titulo}"`,
      });
    }
  }

  return insights;
}
