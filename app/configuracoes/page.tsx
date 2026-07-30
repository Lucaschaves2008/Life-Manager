import { LogOut } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { SettingsForm, type SettingField } from "@/components/shell/settings-form";
import { ProfileInfoForm } from "@/components/shell/profile-info-form";
import { AvatarUpload } from "@/components/shell/avatar-upload";
import { ThemeSelect } from "@/components/shell/theme-select";
import { StravaWidget } from "@/components/treinos/strava-widget";
import { StravaIcon } from "@/components/treinos/strava-icon";
import { StravaCallbackToast } from "@/components/treinos/strava-callback-toast";
import { GoogleCalendarWidget } from "@/components/configuracoes/google-calendar-widget";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";
import { mediumDate } from "@/lib/dates";
import { initials } from "@/lib/utils";
import { stravaConectado, stravaConfigurado } from "@/lib/strava";

export const dynamic = "force-dynamic";

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
    key: "corrida_pace_base_seg",
    label: "Pace base da corrida",
    sufixo: "seg/km",
    ajuda: "Seu pace atual, ex.: 330 = 5'30\"/km. Usado como referência de evolução.",
  },
  {
    key: "corrida_km_semana_base",
    label: "Km base por semana",
    sufixo: "km",
    ajuda: "Sua quilometragem semanal de referência antes do histórico ter dados suficientes.",
  },
  {
    key: "meta_agua_ml",
    label: "Água por dia",
    sufixo: "ml",
    ajuda: "Meta diária usada no diário da dieta.",
  },
  {
    key: "agua_copo_ml",
    label: "Tamanho do copo",
    sufixo: "ml",
    ajuda: "Volume de cada copo no controle de água do diário.",
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
  const user = await getCurrentUser();
  const [rows, conectado] = await Promise.all([
    db.setting.findMany({ where: { userId: user.id } }),
    stravaConectado(user.id),
  ]);
  const values = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const configurado = stravaConfigurado();
  // A conexão passa pela rota /api/strava/connect, que gera o state CSRF
  // aleatório e grava o cookie antes de redirecionar para o Strava.
  const authorizeUrl = configurado
    ? "/api/strava/connect?next=" + encodeURIComponent("/configuracoes")
    : null;

  return (
    <div className="stagger flex flex-col gap-6">
      <StravaCallbackToast />
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-mint-soft text-[16px] font-medium text-mint">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(user.nome, user.email)
            )}
          </div>
          <div>
            <p className="display text-[18px] text-paper">{user.nome || user.email}</p>
            <p className="text-[13px] text-mist">{user.email}</p>
            <p className="mt-0.5 text-[12px] text-steel">
              Membro desde {mediumDate(user.criadoEm)}
            </p>
          </div>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
            Sair
          </Button>
        </form>
      </Card>

      <div className="grid grid-cols-12 gap-6">
        <Card className="col-span-12 lg:col-span-6">
          <CardLabel>Informações</CardLabel>
          <p className="mt-3 text-[13px] text-mist">
            Seus dados de cadastro e login.
          </p>
          <div className="mt-5">
            <ProfileInfoForm nome={user.nome} telefone={user.telefone} email={user.email} />
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-6">
          <CardLabel>Imagem de perfil</CardLabel>
          <p className="mt-3 text-[13px] text-mist">
            Faça o upload da sua imagem de perfil aqui.
          </p>
          <div className="mt-5">
            <AvatarUpload nome={user.nome} email={user.email} avatarUrl={user.avatarUrl} />
          </div>
        </Card>

        <Card className="col-span-12">
          <CardLabel>Preferências</CardLabel>
          <p className="mt-3 text-[13px] text-mist">
            Personalize a aparência do app.
          </p>
          <div className="mt-5 flex items-center justify-between">
            <div>
              <p className="text-[13.5px] text-ice">Tema</p>
              <p className="text-[12px] text-steel">Escolha o tema visual do app.</p>
            </div>
            <ThemeSelect />
          </div>
        </Card>

        <Card className="col-span-12">
          <CardLabel>Integrações</CardLabel>
          <p className="mt-3 text-[13px] text-mist">
            Conecte contas externas para importar dados automaticamente.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-[14px] border border-stroke bg-surface-2 px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fc4c02]/12 text-[#fc4c02]">
                  <StravaIcon className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <p className="text-[13.5px] text-ice">Strava</p>
                  <p className="text-[12px] text-steel">
                    {conectado
                      ? "Conta conectada — importe corridas pelo link em Treinos."
                      : "Conecte para importar suas corridas automaticamente."}
                  </p>
                </div>
              </div>
              <StravaWidget
                configurado={configurado}
                conectado={conectado}
                authorizeUrl={authorizeUrl}
              />
            </div>
            <GoogleCalendarWidget />
          </div>
        </Card>

        <Card className="col-span-12">
          <CardLabel>Metas e limites</CardLabel>
          <p className="mt-3 text-[13px] text-mist">
            Esses números alimentam os cards de acompanhamento e os insights.
          </p>
          <div className="mt-5">
            <SettingsForm fields={metas} values={values} />
          </div>
        </Card>
      </div>
    </div>
  );
}
