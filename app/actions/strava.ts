"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireUser } from "@/lib/auth";
import { tagUsuario } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { sincronizarCorridas } from "@/lib/strava";

/** Puxa as corridas recentes do Strava e importa as novas. Retorna quantas. */
export async function sincronizarStrava(): Promise<number> {
  const { id: userId } = await requireUser();
  try {
    return await sincronizarCorridas(userId);
  } finally {
    // mesmo em falha parcial, corridas já importadas precisam aparecer
    revalidateTag(tagUsuario(userId, "treinos"));
    revalidatePath("/treinos");
  }
}

export async function desconectarStrava(): Promise<void> {
  const { id: userId } = await requireUser();
  await db.stravaAccount.deleteMany({ where: { userId } });
  revalidatePath("/treinos");
}
