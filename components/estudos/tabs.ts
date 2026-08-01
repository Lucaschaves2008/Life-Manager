import type { PillTab } from "@/components/caverna/pill-tabs";

/** Subnavegação única do módulo Estudos (as 3 páginas leem daqui). */
export const ESTUDOS_TABS: PillTab[] = [
  { label: "Cronômetro", href: "/estudos" },
  { label: "Dashboard", href: "/estudos/dashboard" },
  { label: "Tópicos", href: "/estudos/topicos" },
];
