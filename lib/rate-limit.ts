import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";

/**
 * Rate limit de janela fixa, persistido em `seguranca.rate_limit`.
 *
 * A tabela mora FORA do schema public de propósito: o `prisma db push` só
 * gerencia o public (não vai tentar dropá-la) e a Data API do Supabase não
 * expõe outros schemas. Criada por supabase/seguranca.sql.
 *
 * Banco em vez de memória porque na Vercel cada instância tem a própria
 * memória — um contador local seria contornado só por cair em outra instância.
 *
 * Fail-open: se o banco/tabela falhar, libera e loga. Limite é uma camada de
 * defesa, não pode virar o motivo de ninguém conseguir entrar no app.
 */
export async function consumirLimite(
  chave: string,
  max: number,
  janelaSegundos: number
): Promise<boolean> {
  try {
    const rows = await db.$queryRaw<{ contador: number }[]>`
      insert into seguranca.rate_limit as r (chave, contador, janela_inicio)
      values (${chave}, 1, now())
      on conflict (chave) do update set
        contador = case
          when r.janela_inicio < now() - (${janelaSegundos}::float8 * interval '1 second') then 1
          else r.contador + 1
        end,
        janela_inicio = case
          when r.janela_inicio < now() - (${janelaSegundos}::float8 * interval '1 second') then now()
          else r.janela_inicio
        end
      returning contador`;

    // faxina ocasional das janelas velhas — sem cron, ~1% das chamadas.
    if (Math.random() < 0.01) {
      await db.$executeRaw`delete from seguranca.rate_limit where janela_inicio < now() - interval '1 day'`;
    }

    return (rows[0]?.contador ?? 0) <= max;
  } catch (e) {
    console.error("[rate-limit] indisponível (rodou supabase/seguranca.sql?) — liberando:", e);
    return true;
  }
}

/**
 * IP do cliente. Na Vercel `x-real-ip`/`x-forwarded-for` são reescritos pela
 * borda, então o cliente não consegue forjar; fora dela vale só como melhor
 * esforço.
 */
export async function ipDaRequisicao(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "desconhecido"
  );
}

export const MSG_MUITAS_TENTATIVAS =
  "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
