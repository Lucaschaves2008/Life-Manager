import { Card, CardLabel } from "@/components/caverna/card";
import { SettingsForm, type SettingField } from "@/components/shell/settings-form";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const perfil: SettingField[] = [
  { key: "nome_usuario", label: "Como te chamar", tipo: "texto" },
];

const metas: SettingField[] = [
  {
    key: "meta_treinos_semana",
    label: "Treinos por semana",
    sufixo: "treinos",
    ajuda: "Usado no card de treinos da semana e no streak.",
  },
  { key: "meta_treinos_mes", label: "Treinos por mês", sufixo: "treinos" },
  { key: "meta_km_mes", label: "Quilometragem no mês", sufixo: "km" },
  {
    key: "meta_agua_ml",
    label: "Água por dia",
    sufixo: "ml",
    ajuda: "Meta diária usada no diário da dieta.",
  },
  { key: "peso_alvo_kg", label: "Peso alvo", sufixo: "kg" },
  {
    key: "meta_kcal_dia",
    label: "Calorias por dia",
    sufixo: "kcal",
    ajuda: "Deixe vazio para usar a meta da dieta ativa.",
  },
];

export default async function Page() {
  const rows = await db.setting.findMany();
  const values = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return (
    <div className="stagger grid grid-cols-12 gap-6">
      <Card className="col-span-12 lg:col-span-4">
        <CardLabel>Perfil</CardLabel>
        <p className="mt-3 text-[13px] text-mist">
          O LC é local e sem login: tudo fica no seu banco, neste computador.
          Esse nome aparece na saudação da tela inicial.
        </p>
        <div className="mt-5">
          <SettingsForm fields={perfil} values={values} />
        </div>
      </Card>

      <Card className="col-span-12 lg:col-span-8">
        <CardLabel>Metas e limites</CardLabel>
        <p className="mt-3 text-[13px] text-mist">
          Esses números alimentam os cards de acompanhamento e os insights.
        </p>
        <div className="mt-5">
          <SettingsForm fields={metas} values={values} />
        </div>
      </Card>

      <Card className="col-span-12">
        <CardLabel>Dados</CardLabel>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Banco", valor: "SQLite local (prisma/dev.db)" },
            { label: "Fuso", valor: "America/São Paulo" },
            { label: "Moeda", valor: "Real (armazenada em centavos)" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[14px] border border-stroke bg-surface-2 px-4 py-3"
            >
              <p className="text-[11.5px] text-steel">{item.label}</p>
              <p className="mt-1 text-[13.5px] text-ice">{item.valor}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
