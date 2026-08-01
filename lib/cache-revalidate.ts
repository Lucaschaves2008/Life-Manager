import "server-only";
const { revalidatePath: nextRevalidatePath, updateTag: nextUpdateTag } = require("next/cache");

export function revalidatePath(path: string) {
  return nextRevalidatePath(path);
}

// updateTag (não revalidateTag) porque todo call site fica dentro de uma
// server action: dá invalidação IMEDIATA (read-your-own-writes). revalidateTag
// com profile faz stale-while-revalidate em background e explicitamente não
// garante que a própria request (ou a request seguinte) já veja o dado
// novo — foi a causa do card "Patrimônio total" mostrar valor desatualizado
// por 1-2 loads depois de editar um ativo/movimento.
export function revalidateTag(tag: string) {
  return nextUpdateTag(tag);
}
