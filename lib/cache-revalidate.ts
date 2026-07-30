import "server-only";
const { revalidatePath: nextRevalidatePath, revalidateTag: nextRevalidateTag } = require("next/cache");

export function revalidatePath(path: string) {
  return nextRevalidatePath(path);
}

export function revalidateTag(tag: string) {
  // Next 16 revalidateTag requer segundo arg (opcional em runtime, mas TS quer)
  return nextRevalidateTag(tag, "max");
}
