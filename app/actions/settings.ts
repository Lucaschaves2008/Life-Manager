"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

/** Grava as configurações do usuário (chave/valor) numa tacada só. */
export async function saveSettings(entries: Record<string, string>) {
  await Promise.all(
    Object.entries(entries).map(([key, value]) =>
      db.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );

  revalidatePath("/");
  revalidatePath("/configuracoes");
  revalidatePath("/dieta");
  revalidatePath("/treinos");
}
