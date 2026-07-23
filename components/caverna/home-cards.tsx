"use client";

import { useRouter } from "next/navigation";
import {
  StatCardDetalhe,
  type MetricaOpcao,
} from "@/components/caverna/stat-card-detalhe";
import { updateHomeCard } from "@/app/actions/settings";
import type { HomeCardConfig, HomeCardData } from "@/lib/data/home-metricas";
import { HOME_CARD_SLOTS } from "@/lib/home-card-slots";

/**
 * Os 4 cards principais da Home, já calculados no servidor. Cada card pode
 * ter sua métrica/período trocados via popover — a escolha é salva em
 * Setting (server action) e a página é revalidada para refletir o novo dado.
 */
export function HomeCards({
  cards,
  opcoes,
}: {
  cards: { config: HomeCardConfig; data: HomeCardData }[];
  opcoes: MetricaOpcao[];
}) {
  const router = useRouter();

  async function handleChange(slot: string, config: HomeCardConfig) {
    await updateHomeCard(slot, config);
    router.refresh();
  }

  return (
    <div className="stagger grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ config, data }, i) => (
        <StatCardDetalhe
          key={HOME_CARD_SLOTS[i]}
          label={data.label}
          value={data.value}
          pct={data.pct}
          upIsBad={data.upIsBad}
          contexto={data.contexto}
          acento={data.acento}
          descricao={data.descricao}
          grupos={data.grupos}
          total={data.total}
          verMais={data.verMais}
          configuravel={{
            config,
            opcoes,
            onChange: (novaConfig) => handleChange(HOME_CARD_SLOTS[i], novaConfig),
          }}
        />
      ))}
    </div>
  );
}
