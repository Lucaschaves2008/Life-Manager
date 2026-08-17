/**
 * Materializa em linhas reais e independentes por semana o que hoje só existe
 * como override implícito (RoutineWeekExercise/RunSessionWeek + weekConfig/
 * kmDaSemana = "repete até editar"). Depois deste backfill, cada semana >= 2
 * que tinha algum override editado ganha suas próprias linhas de
 * RoutineExercise/RunSession (resolvidas com a MESMA lógica que a tela usava
 * pra exibir), preservando exatamente o que o usuário via antes da mudança —
 * só que agora editável sem afetar as outras semanas. Roda uma vez,
 * manualmente, antes do deploy da nova versão do módulo de Treinos:
 *   npx tsx prisma/backfill-semanas-treino.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Cópia standalone da lógica "repete até editar" que a tela usava pra
// resolver a config efetiva de uma semana (removida de lib/data/treinos-format.ts
// depois que o modelo virou semanas independentes) — preservada aqui só pra
// este script de migração continuar reproduzível/legível no histórico.
function weekConfig(
  base: { series: number; repsAlvo: string; cargaAtual: number },
  overrides: { semana: number; series: number; repsAlvo: string; cargaAtual: number }[],
  semana: number
) {
  const alvo = Math.max(1, Math.floor(semana) || 1);
  const anterior = overrides
    .filter((w) => w.semana <= alvo)
    .sort((a, b) => b.semana - a.semana)[0];
  if (!anterior) return { ...base };
  return { series: anterior.series, repsAlvo: anterior.repsAlvo, cargaAtual: anterior.cargaAtual };
}

function kmDaSemana(
  base: number,
  overrides: { semana: number; kmAlvo: number }[],
  semana: number
) {
  const alvo = Math.max(1, Math.floor(semana) || 1);
  const anterior = overrides
    .filter((w) => w.semana <= alvo)
    .sort((a, b) => b.semana - a.semana)[0];
  return { kmAlvo: anterior ? anterior.kmAlvo : base };
}

async function backfillMusculacao() {
  const rotinas = await db.routine.findMany({
    include: {
      exercises: {
        include: { weeks: true },
      },
    },
  });

  let criados = 0;
  for (const rotina of rotinas) {
    const maxSemana = Math.max(
      1,
      ...rotina.exercises.flatMap((e) => e.weeks.map((w) => w.semana))
    );
    if (maxSemana <= 1) continue;

    for (const exercicio of rotina.exercises) {
      for (let semana = 2; semana <= maxSemana; semana++) {
        const cfg = weekConfig(
          {
            series: exercicio.series,
            repsAlvo: exercicio.repsAlvo,
            cargaAtual: exercicio.cargaAtual,
          },
          exercicio.weeks.map((w) => ({
            semana: w.semana,
            series: w.series,
            repsAlvo: w.repsAlvo,
            cargaAtual: w.cargaAtual,
          })),
          semana
        );
        await db.routineExercise.create({
          data: {
            userId: exercicio.userId,
            nome: exercicio.nome,
            grupoMuscular: exercicio.grupoMuscular,
            tipoAlvo: exercicio.tipoAlvo,
            series: cfg.series,
            repsAlvo: cfg.repsAlvo,
            cargaAtual: cfg.cargaAtual,
            tempoAlvoSeg: exercicio.tempoAlvoSeg,
            descansoSeg: exercicio.descansoSeg,
            observacao: exercicio.observacao,
            ordem: exercicio.ordem,
            metodo: exercicio.metodo,
            routineId: exercicio.routineId,
            semana,
          },
        });
        criados++;
      }
    }
    console.log(
      `  ficha ${rotina.id} (${rotina.nome}): materializada até semana ${maxSemana}`
    );
  }
  console.log(`Musculação: ${criados} linhas criadas.`);
}

async function backfillCorrida() {
  const planos = await db.runRoutine.findMany({
    include: {
      sessions: {
        include: { weeks: true },
      },
    },
  });

  let criados = 0;
  for (const plano of planos) {
    const maxSemana = Math.max(
      1,
      ...plano.sessions.flatMap((s) => s.weeks.map((w) => w.semana))
    );
    if (maxSemana <= 1) continue;

    for (const sessao of plano.sessions) {
      for (let semana = 2; semana <= maxSemana; semana++) {
        const km = kmDaSemana(
          sessao.kmAlvo,
          sessao.weeks.map((w) => ({ semana: w.semana, kmAlvo: w.kmAlvo })),
          semana
        );
        await db.runSession.create({
          data: {
            userId: sessao.userId,
            nome: sessao.nome,
            tipo: sessao.tipo,
            kmAlvo: km.kmAlvo,
            paceAlvoSeg: sessao.paceAlvoSeg,
            ordem: sessao.ordem,
            routineId: sessao.routineId,
            semana,
          },
        });
        criados++;
      }
    }
    console.log(
      `  plano ${plano.id} (${plano.nome}): materializado até semana ${maxSemana}`
    );
  }
  console.log(`Corrida: ${criados} linhas criadas.`);
}

async function main() {
  console.log("Backfill de semanas — musculação:");
  await backfillMusculacao();
  console.log("Backfill de semanas — corrida/natação/ciclismo:");
  await backfillCorrida();
  console.log("Backfill concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
