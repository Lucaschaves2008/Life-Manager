/**
 * Instituições financeiras conhecidas, para o seletor de cartão e o logo
 * exibido no card da fatura. `arquivo` aponta para public/brand/bancos/*.png —
 * enquanto o arquivo não existir, o componente <LogoInstituicao> cai no
 * fallback de círculo colorido com a inicial (ver components/financas/logo-instituicao.tsx).
 */
export type InstituicaoFinanceira = {
  slug: string;
  nome: string;
  cor: string;
  arquivo: string;
};

export const INSTITUICOES: InstituicaoFinanceira[] = [
  { slug: "nubank", nome: "Nubank", cor: "#8A05BE", arquivo: "/brand/bancos/nubank.png" },
  { slug: "inter", nome: "Inter", cor: "#FF7A00", arquivo: "/brand/bancos/inter.png" },
  { slug: "itau", nome: "Itaú", cor: "#EC7000", arquivo: "/brand/bancos/itau.png" },
  { slug: "bradesco", nome: "Bradesco", cor: "#CC092F", arquivo: "/brand/bancos/bradesco.png" },
  { slug: "santander", nome: "Santander", cor: "#EC0000", arquivo: "/brand/bancos/santander.png" },
  { slug: "bb", nome: "Banco do Brasil", cor: "#FADB00", arquivo: "/brand/bancos/bb.png" },
  { slug: "caixa", nome: "Caixa", cor: "#0070AD", arquivo: "/brand/bancos/caixa.png" },
  { slug: "xp", nome: "XP", cor: "#000000", arquivo: "/brand/bancos/xp.png" },
  { slug: "btg", nome: "BTG Pactual", cor: "#0B2A4A", arquivo: "/brand/bancos/btg.png" },
  { slug: "c6", nome: "C6 Bank", cor: "#1E1E1E", arquivo: "/brand/bancos/c6.png" },
  { slug: "will", nome: "Will Bank", cor: "#00C853", arquivo: "/brand/bancos/will.png" },
  { slug: "picpay", nome: "PicPay", cor: "#21C25E", arquivo: "/brand/bancos/picpay.png" },
  { slug: "mercadopago", nome: "Mercado Pago", cor: "#00B1EA", arquivo: "/brand/bancos/mercadopago.png" },
];

export function instituicaoPorSlug(slug: string | null | undefined): InstituicaoFinanceira | null {
  if (!slug) return null;
  return INSTITUICOES.find((i) => i.slug === slug) ?? null;
}
