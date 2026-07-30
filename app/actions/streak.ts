"use server";

import { revalidatePath, revalidateTag } from "@/lib/cache-revalidate";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { tagUsuario } from "@/lib/cache-tags";
import { spEndOfDay, spStartOfDay, nowSP, dayKeySP } from "@/lib/dates";

/**
 * Zera o streak do PRÓPRIO administrador apagando somente as atividades de
 * HOJE (SP) que sustentam o foguinho — treinos, corridas, diário de dieta,
 * check-ins de rotina e sessões de estudo. Dias anteriores ficam intactos.
 *
 * Restrito a super_admin: é uma ferramenta de teste do foguinho, não um
 * recurso de produto. IRREVERSÍVEL (apaga registros reais do dia).
 */
export async function zerarMeuStreakHoje() {
  const { id: userId } = await requireSuperAdmin();

  const ref = nowSP();
  const janela = { gte: spStartOfDay(ref), lte: spEndOfDay(ref) };
  const hoje = dayKeySP(ref);

  // studySession tem StudyMark/StudyPause com onDelete: Cascade — deletar a
  // sessão limpa os filhos automaticamente. Também apaga o StreakDia de hoje
  // (fonte de verdade do foguinho) — sem isso o "zerar" não zeraria mais.
  const [tre, run, die, chk, stu] = await db.$transaction([
    db.workoutSession.deleteMany({ where: { userId, data: janela } }),
    db.run.deleteMany({ where: { userId, data: janela } }),
    db.dietDayLog.deleteMany({ where: { userId, data: janela } }),
    db.rotinaCheckDia.deleteMany({ where: { userId, data: janela } }),
    db.studySession.deleteMany({ where: { userId, startedAt: janela } }),
    db.streakDia.deleteMany({ where: { userId, dia: hoje } }),
  ]);

  // invalida tudo que alimenta streakLC + as páginas que o exibem
  revalidateTag(tagUsuario(userId, "streak"));
  revalidateTag(tagUsuario(userId, "treinos"));
  revalidateTag(tagUsuario(userId, "dieta"));
  revalidateTag(tagUsuario(userId, "checklist"));
  revalidateTag(tagUsuario(userId, "estudos"));
  revalidatePath("/");

  return {
    ok: true,
    apagados: {
      treinos: tre.count,
      corridas: run.count,
      diarios: die.count,
      checkins: chk.count,
      estudos: stu.count,
    },
  };
}
