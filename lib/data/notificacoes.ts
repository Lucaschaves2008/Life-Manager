import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
} from "next/cache";
import { db } from "@/lib/db";
import { tagUsuario } from "@/lib/cache-tags";
import { dayKeySP, refDoDiaSP, spStartOfDay, toSP } from "@/lib/dates";

export type NotificacaoRevisao = {
  id: string;
  assetId: string;
  nome: string;
  instituicao: string;
  cor: string;
  diasRestantes: number;
  vencida: boolean;
};

/**
 * Ativos com revisão de valor configurada cujo próximo vencimento cai dentro
 * da janela [-∞, +7 dias] (inclui atrasados). Alimenta o sino de notificações.
 */
export async function revisoesPendentes(
  userId: string,
  ref: Date = new Date()
): Promise<NotificacaoRevisao[]> {
  // wrapper: converte o Date de request em chave estável por dia
  return revisoesPendentesDoDia(userId, dayKeySP(ref));
}

async function revisoesPendentesDoDia(
  userId: string,
  dia: string
): Promise<NotificacaoRevisao[]> {
  "use cache";
  cacheTag(tagUsuario(userId, "investimentos"));
  cacheLife("days");

  const hoje = refDoDiaSP(dia); // início do dia em SP
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + 7);

  const ativos = await db.asset.findMany({
    where: { userId, proximaRevisao: { lte: limite } },
    orderBy: { proximaRevisao: "asc" },
  });

  return ativos.map((a) => {
    const dataRevisao = spStartOfDay(toSP(a.proximaRevisao!));
    const diasRestantes = Math.round(
      (dataRevisao.getTime() - hoje.getTime()) / 86_400_000
    );
    return {
      id: a.id,
      assetId: a.id,
      nome: a.nome,
      instituicao: a.instituicao,
      cor: a.cor,
      diasRestantes,
      vencida: diasRestantes < 0,
    };
  });
}
