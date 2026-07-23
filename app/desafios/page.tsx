import { Swords } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { DesafiosList } from "@/components/desafios/desafios-list";
import { desafiosDoUsuario } from "@/lib/data/desafios";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getCurrentUser();
  const desafios = await desafiosDoUsuario(user.id);

  return (
    <div className="flex flex-col gap-6">
      <header className="card-in flex flex-wrap items-end justify-between gap-4 pt-2">
        <div>
          <p className="microlabel text-steel">Grupos de crescimento</p>
          <h1 className="display mt-1.5 text-[30px] leading-none text-paper md:text-[34px]">
            Desafios
          </h1>
        </div>
      </header>

      <Card>
        <div className="flex items-center justify-between">
          <CardLabel>Seus desafios</CardLabel>
          {desafios.length > 0 && (
            <span className="flex items-center gap-1.5 text-[12px] text-steel">
              <Swords className="h-3.5 w-3.5" strokeWidth={1.5} />
              {desafios.length}
            </span>
          )}
        </div>
        <div className="mt-4">
          <DesafiosList desafios={desafios} />
        </div>
      </Card>
    </div>
  );
}
