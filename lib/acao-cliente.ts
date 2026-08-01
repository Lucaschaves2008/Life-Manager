"use client";

import { useTransition } from "react";
import { toast } from "sonner";

/**
 * Traduz o erro cru de uma Server Action para uma frase que o usuário entende.
 *
 * A regra é sempre dizer se o dado foi salvo ou não: o pior cenário é o
 * usuário achar que gravou quando não gravou.
 */
export function mensagemDeErro(erro: unknown): string {
  const bruto = erro instanceof Error ? erro.message : String(erro);

  // Erros de negócio que as actions lançam de propósito — texto já é pro usuário.
  if (/^(Não autenticado|Conta bloqueada|Acesso restrito)/i.test(bruto)) return bruto;

  // Falha de rede: o fetch da Server Action nem chegou no servidor.
  if (/failed to fetch|networkerror|load failed|err_/i.test(bruto)) {
    return "Sem conexão com o servidor. Nada foi salvo — tente de novo.";
  }

  // P2024 = pool de conexões do Prisma esgotado; P1001 = banco inalcançável.
  if (/P2024|P1001|connection pool|timed out fetching/i.test(bruto)) {
    return "O banco demorou demais para responder. Nada foi salvo — tente de novo.";
  }

  return "Não foi possível salvar. Nada foi alterado — tente de novo.";
}

type OpcoesAcao = {
  /** Toast verde quando a action conclui sem erro. */
  sucesso?: string;
  /**
   * Desfaz a atualização otimista. Obrigatório sempre que a UI já mudou antes
   * da resposta do servidor — sem isso a tela mente: mostra o item marcado/
   * criado enquanto o banco não gravou nada.
   */
  aoFalhar?: () => void;
};

/**
 * Executa uma Server Action dentro de uma transition com tratamento de erro.
 *
 * Por que existe: `startTransition(async () => { await action() })` sem
 * try/catch faz a rejeição escapar como exceção não capturada. Sem error
 * boundary no meio, o React desmonta a subárvore — o bloco simplesmente some
 * da tela, sem aviso nenhum, e o usuário conclui que "o banco não salvou".
 * Foi exatamente o que reproduzimos abortando o POST da action no /checklist.
 *
 * Uso:
 *   const [salvando, executar] = useAcao();
 *   executar(() => createHabit(nome), { sucesso: "Hábito adicionado" });
 */
export function useAcao() {
  const [pendente, startTransition] = useTransition();

  const executar = (acao: () => Promise<unknown>, opcoes: OpcoesAcao = {}) => {
    startTransition(async () => {
      try {
        await acao();
        if (opcoes.sucesso) toast.success(opcoes.sucesso);
      } catch (erro) {
        opcoes.aoFalhar?.();
        toast.error(mensagemDeErro(erro));
      }
    });
  };

  return [pendente, executar] as const;
}
