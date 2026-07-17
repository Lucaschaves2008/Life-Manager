import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { AgendaClient } from "@/components/agenda/agenda-client";
import { feriadosComoEventos, ocorrencias } from "@/lib/data/agenda";
import { dayKeySP, nowSP, spEndOfDay, spStartOfDay, toSP } from "@/lib/dates";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Busca = { view?: string; data?: string; novo?: string };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const busca = await searchParams;
  const view =
    busca.view === "dia" || busca.view === "mes" ? busca.view : "semana";
  const dataBase = /^\d{4}-\d{2}-\d{2}$/.test(busca.data ?? "")
    ? busca.data!
    : dayKeySP(nowSP());

  const ancora = toSP(new Date(`${dataBase}T12:00:00-03:00`));

  const { de, ate } =
    view === "dia"
      ? { de: spStartOfDay(ancora), ate: spEndOfDay(ancora) }
      : view === "semana"
      ? {
          de: spStartOfDay(startOfWeek(ancora, { weekStartsOn: 0 })),
          ate: spEndOfDay(addDays(startOfWeek(ancora, { weekStartsOn: 0 }), 6)),
        }
      : {
          de: spStartOfDay(startOfWeek(startOfMonth(ancora), { weekStartsOn: 0 })),
          ate: spEndOfDay(endOfWeek(endOfMonth(ancora), { weekStartsOn: 0 })),
        };

  const [eventos, calendarios] = await Promise.all([
    ocorrencias(de, ate),
    db.calendar.findMany({ orderBy: { ordem: "asc" } }),
  ]);

  const feriadosVisiveis = calendarios.some((c) => c.readonly && c.visivel);
  const feriados = feriadosVisiveis ? await feriadosComoEventos(de, ate) : [];

  return (
    <AgendaClient
      ocorrencias={[...eventos, ...feriados]}
      calendarios={calendarios.map((c) => ({
        id: c.id,
        nome: c.nome,
        cor: c.cor,
        visivel: c.visivel,
        readonly: c.readonly,
      }))}
      view={view}
      dataBase={dataBase}
      abrirNovo={busca.novo === "1"}
    />
  );
}
