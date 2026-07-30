import "server-only";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { tagUsuario } from "@/lib/cache-tags";
import { dayKeySP, nowSP } from "@/lib/dates";

/**
 * Marca que o usuário esteve ATIVO num dia — grava um StreakDia permanente.
 * Chamado por qualquer server action que represente atividade real: marcar
 * check-in, registrar treino/corrida, preencher dieta, iniciar estudo.
 *
 * `dia` pode ser um dayKey "YYYY-MM-DD" (quando a ação é sobre um dia
 * específico, ex.: marcar um check-in de outro dia) ou omitido para hoje (SP).
 *
 * Idempotente (upsert por [userId, dia]) e IRREVERSÍVEL por design: desfazer a
 * ação depois (desmarcar o check-in) NÃO apaga o dia — a ofensiva daquele dia
 * já foi conquistada. Invalida o cache do streak.
 */
export async function marcarDiaAtivo(userId: string, dia?: string) {
  const dayKey = dia ?? dayKeySP(nowSP());
  await db.streakDia.upsert({
    where: { userId_dia: { userId, dia: dayKey } },
    create: { userId, dia: dayKey },
    update: {}, // já existe → nada a fazer (permanência)
  });
  revalidateTag(tagUsuario(userId, "streak"));
}
