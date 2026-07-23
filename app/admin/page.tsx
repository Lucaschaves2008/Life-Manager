import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { UsuariosClient } from "@/components/admin/usuarios-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireSuperAdmin();

  const usuarios = await db.profile.findMany({ orderBy: { criadoEm: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="display text-[18px] text-paper">Usuários</h2>
        <p className="text-[13px] text-mist">
          Gerencie quem tem acesso ao LC, bloqueie contas e promova administradores.
        </p>
      </div>
      <UsuariosClient usuarios={usuarios} />
    </div>
  );
}
