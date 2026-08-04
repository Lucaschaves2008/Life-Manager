/**
 * Zera os DADOS DE USO de uma conta, preservando a identidade.
 *
 * O que sobrevive: Profile (id, email, nome, telefone, avatarUrl, role, status)
 * e a conta no Supabase Auth — ou seja, o login e o papel super_admin ficam
 * intactos. Nenhum modelo tem FK para Profile (userId é string solta), então
 * nada cascateia sozinho: a varredura abaixo é explícita e ordenada folha→raiz.
 *
 * Uso:
 *   npx tsx prisma/reset-dados-usuario.ts            → só CONTA, não apaga
 *   npx tsx prisma/reset-dados-usuario.ts --apagar   → apaga de verdade
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const EMAIL = process.env.RESET_EMAIL ?? "lucas.chaves@providence.solutions";
const APAGAR = process.argv.includes("--apagar");

async function main() {
  const profile = await db.profile.findUnique({ where: { email: EMAIL } });
  if (!profile) throw new Error(`Profile não encontrado para ${EMAIL}.`);

  const userId = profile.id;
  const w = { userId };

  console.log(`\nConta: ${EMAIL}`);
  console.log(`userId: ${userId}`);
  console.log(`role:   ${profile.role}  (preservado)\n`);

  // ---- Desafios: separa o que é meu do que é compartilhado -----------------
  const meusDesafios = await db.desafio.findMany({
    where: { criadorId: userId },
    select: { id: true, nome: true, _count: { select: { membros: true } } },
  });
  // Criados por mim que ainda têm outros membros: NÃO apago (apagaria o grupo
  // inteiro por cascata, junto com metas/mensagens dos outros). Só saio.
  const desafiosComOutros = meusDesafios.filter((d) => d._count.membros > 1);
  const desafiosSozinho = meusDesafios.filter((d) => d._count.membros <= 1);

  const contagens: Record<string, number> = {
    // Finanças / Investimentos (cascateiam de ContaFinanceira, mas conto tudo)
    Transaction: await db.transaction.count({ where: w }),
    Account: await db.account.count({ where: w }),
    Category: await db.category.count({ where: w }),
    Card: await db.card.count({ where: w }),
    Subscription: await db.subscription.count({ where: w }),
    MetaPoupancaContribuicao: await db.metaPoupancaContribuicao.count({ where: w }),
    MetaPoupanca: await db.metaPoupanca.count({ where: w }),
    AssetMovement: await db.assetMovement.count({ where: w }),
    Asset: await db.asset.count({ where: w }),
    ContaFinanceira: await db.contaFinanceira.count({ where: w }),
    // Dieta
    RecipeItem: await db.recipeItem.count({ where: w }),
    Recipe: await db.recipe.count({ where: w }),
    MealOption: await db.mealOption.count({ where: w }),
    Meal: await db.meal.count({ where: w }),
    Diet: await db.diet.count({ where: w }),
    Food: await db.food.count({ where: w }),
    DietDayLog: await db.dietDayLog.count({ where: w }),
    WeightLog: await db.weightLog.count({ where: w }),
    // Treinos
    SetLog: await db.setLog.count({ where: w }),
    WorkoutSession: await db.workoutSession.count({ where: w }),
    RoutineWeekExercise: await db.routineWeekExercise.count({ where: w }),
    RoutineExercise: await db.routineExercise.count({ where: w }),
    Routine: await db.routine.count({ where: w }),
    // Corrida
    Run: await db.run.count({ where: w }),
    RunSessionWeek: await db.runSessionWeek.count({ where: w }),
    RunSession: await db.runSession.count({ where: w }),
    RunRoutine: await db.runRoutine.count({ where: w }),
    // Estudos
    StudyMark: await db.studyMark.count({ where: w }),
    StudyPause: await db.studyPause.count({ where: w }),
    StudySession: await db.studySession.count({ where: w }),
    StudyCategory: await db.studyCategory.count({ where: w }),
    // Agenda
    EventNote: await db.eventNote.count({ where: w }),
    Event: await db.event.count({ where: w }),
    Calendar: await db.calendar.count({ where: w }),
    // Metas / checklist / streak
    Goal: await db.goal.count({ where: w }),
    MetaQuantitativa: await db.metaQuantitativa.count({ where: w }),
    DinheiroLancamento: await db.dinheiroLancamento.count({ where: w }),
    VariavelCheckDia: await db.variavelCheckDia.count({ where: w }),
    Variavel: await db.variavel.count({ where: w }),
    HabitDayLog: await db.habitDayLog.count({ where: w }),
    Habit: await db.habit.count({ where: w }),
    RotinaCheckDia: await db.rotinaCheckDia.count({ where: w }),
    RotinaTemplate: await db.rotinaTemplate.count({ where: w }),
    RotinaDiaPlano: await db.rotinaDiaPlano.count({ where: w }),
    RotinaPlano: await db.rotinaPlano.count({ where: w }),
    DiaRegistro: await db.diaRegistro.count({ where: w }),
    StreakDia: await db.streakDia.count({ where: w }),
    // Desafios (minha participação)
    DesafioMeta: await db.desafioMeta.count({ where: w }),
    DesafioMensagem: await db.desafioMensagem.count({ where: w }),
    DesafioMembro: await db.desafioMembro.count({ where: w }),
    // Integrações + preferências
    StravaAccount: await db.stravaAccount.count({ where: w }),
    GoogleIntegration: await db.googleIntegration.count({ where: w }),
    Setting: await db.setting.count({ where: w }),
  };

  const total = Object.values(contagens).reduce((a, b) => a + b, 0);
  for (const [tabela, n] of Object.entries(contagens)) {
    if (n > 0) console.log(`  ${tabela.padEnd(26)} ${n}`);
  }
  console.log(`\n  ${"TOTAL".padEnd(26)} ${total} registros`);

  if (desafiosComOutros.length) {
    console.log(`\n  Desafios criados por você COM outros membros (só vou SAIR, não apagar):`);
    for (const d of desafiosComOutros) {
      console.log(`    · ${d.nome} — ${d._count.membros} membros`);
    }
  }
  if (desafiosSozinho.length) {
    console.log(`\n  Desafios criados por você sem outros membros (serão APAGADOS):`);
    for (const d of desafiosSozinho) console.log(`    · ${d.nome}`);
  }

  if (!APAGAR) {
    console.log(`\n[modo contagem] Nada foi apagado. Rode com --apagar para executar.\n`);
    return;
  }

  console.log(`\n[apagando] tudo dentro de uma transação...\n`);

  await db.$transaction(async (tx) => {
    // Ordem folha→raiz. Onde há cascata a chamada é redundante, mas explícita
    // é mais seguro do que confiar no grafo de FK.
    await tx.setLog.deleteMany({ where: w });
    await tx.workoutSession.deleteMany({ where: w });
    await tx.routineWeekExercise.deleteMany({ where: w });
    await tx.routineExercise.deleteMany({ where: w });
    await tx.routine.deleteMany({ where: w });

    await tx.run.deleteMany({ where: w });
    await tx.runSessionWeek.deleteMany({ where: w });
    await tx.runSession.deleteMany({ where: w });
    await tx.runRoutine.deleteMany({ where: w });

    await tx.recipeItem.deleteMany({ where: w });
    await tx.mealOption.deleteMany({ where: w });
    await tx.recipe.deleteMany({ where: w });
    await tx.meal.deleteMany({ where: w });
    await tx.diet.deleteMany({ where: w });
    await tx.food.deleteMany({ where: w });
    await tx.dietDayLog.deleteMany({ where: w });
    await tx.weightLog.deleteMany({ where: w });

    await tx.studyMark.deleteMany({ where: w });
    await tx.studyPause.deleteMany({ where: w });
    await tx.studySession.deleteMany({ where: w });
    await tx.studyCategory.deleteMany({ where: w });

    await tx.eventNote.deleteMany({ where: w });
    await tx.event.deleteMany({ where: w });
    await tx.calendar.deleteMany({ where: w });

    await tx.goal.deleteMany({ where: w });
    await tx.metaQuantitativa.deleteMany({ where: w });
    await tx.dinheiroLancamento.deleteMany({ where: w });
    await tx.variavelCheckDia.deleteMany({ where: w });
    await tx.variavel.deleteMany({ where: w });
    await tx.habitDayLog.deleteMany({ where: w });
    await tx.habit.deleteMany({ where: w });
    await tx.rotinaCheckDia.deleteMany({ where: w });
    await tx.rotinaTemplate.deleteMany({ where: w });
    await tx.rotinaDiaPlano.deleteMany({ where: w });
    await tx.rotinaPlano.deleteMany({ where: w });
    await tx.diaRegistro.deleteMany({ where: w });
    await tx.streakDia.deleteMany({ where: w });

    // Finanças / Investimentos
    await tx.metaPoupancaContribuicao.deleteMany({ where: w });
    await tx.metaPoupanca.deleteMany({ where: w });
    await tx.transaction.deleteMany({ where: w });
    await tx.assetMovement.deleteMany({ where: w });
    await tx.asset.deleteMany({ where: w });
    await tx.subscription.deleteMany({ where: w });
    await tx.card.deleteMany({ where: w });
    await tx.category.deleteMany({ where: w });
    await tx.account.deleteMany({ where: w });
    await tx.contaFinanceira.deleteMany({ where: w });

    // Desafios: minhas metas e mensagens sempre saem; a participação também.
    await tx.desafioMeta.deleteMany({ where: w });
    await tx.desafioMensagem.deleteMany({ where: w });
    await tx.desafioMembro.deleteMany({ where: w });
    // Só apago o grupo quando não há mais ninguém além de mim.
    for (const d of desafiosSozinho) {
      await tx.desafio.delete({ where: { id: d.id } });
    }

    // Integrações OAuth + preferências de interface
    await tx.stravaAccount.deleteMany({ where: w });
    await tx.googleIntegration.deleteMany({ where: w });
    await tx.setting.deleteMany({ where: w });
  });

  const restante = await db.profile.findUnique({ where: { id: userId } });
  console.log(`Pronto.`);
  console.log(`Profile preservado: ${restante?.email} · role=${restante?.role} · status=${restante?.status}\n`);
}

main()
  .catch((e) => {
    console.error(`\nFalhou (nada foi apagado, a transação reverteu):\n`, e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
