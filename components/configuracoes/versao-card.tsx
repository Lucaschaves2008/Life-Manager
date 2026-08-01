import { Card, CardLabel } from "@/components/caverna/card";
import { fmtSP } from "@/lib/dates";

/**
 * Identidade exata do build que está servindo esta página.
 *
 * O commit é o campo que importa: se o que aparece aqui no site for igual ao
 * `git rev-parse --short HEAD` da sua máquina, produção está rodando o mesmo
 * código que você tem local. A versão sozinha não prova nada — dois builds
 * diferentes podem carregar o mesmo "1.1.0".
 */
export function VersaoCard() {
  const versao = process.env.NEXT_PUBLIC_APP_VERSAO ?? "?";
  const commit = process.env.NEXT_PUBLIC_APP_COMMIT ?? "desconhecido";
  const ambiente = process.env.NEXT_PUBLIC_APP_AMBIENTE ?? "local";
  const build = process.env.NEXT_PUBLIC_APP_BUILD;

  const linhas = [
    { rotulo: "Versão", valor: `v${versao}` },
    { rotulo: "Commit", valor: commit, mono: true },
    { rotulo: "Ambiente", valor: ambiente === "production" ? "produção" : ambiente },
    {
      rotulo: "Build",
      valor: build ? fmtSP(new Date(build), "dd/MM/yyyy 'às' HH:mm") : "—",
    },
  ];

  return (
    <Card className="col-span-12">
      <CardLabel>Versão</CardLabel>
      <p className="mt-3 text-[13px] text-mist">
        Confira se o site está rodando o mesmo código da sua máquina: o commit abaixo
        tem que bater com o do seu <code className="text-ice">git log</code>.
      </p>
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {linhas.map((l) => (
          <div key={l.rotulo}>
            <dt className="microlabel">{l.rotulo}</dt>
            <dd
              className={`mt-1 text-[13.5px] text-ice ${l.mono ? "font-mono" : ""}`}
            >
              {l.valor}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
