import "server-only";
import { cookies } from "next/headers";
import { listarContasFinanceiras } from "@/app/actions/contas-financeiras";
import {
  COOKIE_CONTA_ATIVA,
  type ContaFinanceiraView,
} from "@/lib/contas-financeiras-shared";

export type ContaAtiva = {
  id: string;
  contas: ContaFinanceiraView[];
};

/** Resolve a conta financeira ativa da sessão (cookie → padrão → primeira). */
export async function getContaAtiva(userId: string): Promise<ContaAtiva> {
  const [cookieStore, contas] = await Promise.all([
    cookies(),
    listarContasFinanceiras(userId),
  ]);
  const cookieId = cookieStore.get(COOKIE_CONTA_ATIVA)?.value;
  const ativa =
    contas.find((c) => c.id === cookieId) ??
    contas.find((c) => c.padrao) ??
    contas[0];
  return { id: ativa.id, contas };
}
