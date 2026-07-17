# BRIEF DOS MÓDULOS — Caverna

Você está construindo UM módulo do "Caverna", um life-manager pessoal dark premium
(single-user, sem login, pt-BR). Leia este arquivo INTEIRO antes de escrever código.

## Regras inegociáveis

1. **100% da interface em pt-BR.** Dinheiro `R$ 1.234,56` via helpers de `lib/money.ts`.
   Datas via `lib/dates.ts` (fuso America/Sao_Paulo, locale ptBR). NUNCA `toLocaleDateString` direto.
2. **Dinheiro em centavos (Int)** no banco. Nunca float.
3. **Cores SEMPRE via tokens** (classes Tailwind `bg-surface`, `text-mist`, `border-stroke`,
   `text-mint`, `bg-mint-soft`, `text-coral`, `text-amber`, `bg-elevated`, `text-ice`,
   `text-paper`, `text-steel`, `bg-surface-2`, `bg-navy`). PROIBIDO: `#000`, `#fff`,
   cinzas do Tailwind (zinc/gray/slate), azul #0066FF, gradiente roxo/rosa, `shadow-sm/md`.
4. Verde (mint) = positivo/dinheiro entrando/meta batida. Coral = negativo/gasto subindo. Nunca inverter.
5. Bordas 1px `border-stroke` no lugar de sombras. Sombra SÓ em popover/modal (já embutida nas primitivas).
6. **Um (e só um) card `destaque` por tela** (prop `destaque` do `Card`).
7. Serif (`className="display"`) SÓ em títulos de página/headline de insight. Números de dados
   sempre com classe `tabular`. Micro-labels com classe `microlabel`.
8. Raios: cards 20px (o `Card` já faz), internos 12–14px, pills 999px. Grid de 8px, padding de card 24px.
9. Bento grid assimétrico (grid-cols-12 com spans diferentes). NUNCA 3 cards iguais lado a lado.
10. Empty states desenhados com `EmptyState` em TODA lista/tela vazia. Skeletons com classe `skeleton`
    num `loading.tsx` da rota.
11. Gráficos: use `components/charts/theme.ts` + `ChartTooltip`. Grid só horizontal, eixos sem linha,
    labels 11px steel, barras raio 6 no topo, animação única de ~800ms. Nada de visual default do Recharts.
12. Emoji só como ícone de categoria/refeição. Ícones lucide com `strokeWidth={1.5}`.
13. Toasts com `toast` do `sonner` (já estilizado no layout). Exclusões com ação "Desfazer" (undo)
    que recria o registro via server action.

## Stack e convenções de arquivos

- Next.js 15 App Router + TS. Prisma + SQLite. O schema (`prisma/schema.prisma`) é FINAL — NÃO altere,
  NÃO rode `prisma db push`, NÃO rode o seed, NÃO rode `npm run build` (o orquestrador roda).
  Para checar tipos: `npx tsc --noEmit` (pode rodar à vontade).
- Páginas do seu módulo: `app/<modulo>/…` (server components async, `export const dynamic = "force-dynamic"`).
- Server actions: `app/actions/<modulo>.ts` (`"use server"`, revalidatePath).
- Componentes do módulo: `components/<modulo>/…`.
- Data layer: `lib/data/<modulo>.ts` (funções server-only que consultam o Prisma via `db` de `lib/db.ts`).
- NÃO edite arquivos compartilhados (`app/layout.tsx`, shell, `components/ui/*`, `components/caverna/*`,
  `lib/*.ts` na raiz, `package.json`, `globals.css`). Exceção: `lib/data/<seu-modulo>.ts` é seu.
- Sub-abas de módulo: navegação por search param `?tab=` usando `PillTabs` com `param="tab"`,
  ou rotas aninhadas — sua escolha, mas o padrão visual é o PillTabs.
- Se a página usa `useSearchParams` em client component, envolva em `<Suspense>`.
- A página principal do módulo deve honrar `?novo=1` abrindo o formulário de criação principal.

## Componentes prontos (USE-OS — não recrie)

`components/caverna/`:
- `Card` (`destaque?`), `CardLabel` — card base + micro-label.
- `HeroInsight` (`insight`, `miniCards`) — headline serif colorida por severidade + parágrafo + 3 mini-cards.
- `StatCard` (`label`, `value`, `pct?`, `upIsBad?`, `extra?`, `destaque?`).
- `VariationBadge` (`pct`, `upIsBad?`) — ↗/↘ com soft-bg.
- `HeroMoney` (`centavos`, `size`, `ticker?`) — R$ pequeno + inteiro grande + centavos pequenos.
- `NumberTicker` (`value`, `format`).
- `Donut` (`pct?` ou `segments?`, `legend?`, `center?`) — anel de progresso/alocação.
- `Heatmap` (`cells`, `cor` rgb string, `columns`, `max?`) — mapa de calor GitHub-style.
- `EmptyState` (`icon`, `title`, `action?`).
- `PillTabs` (`tabs`, `param?`) — subnavegação pill.
- `Segmented` (`options`, `value`, `onChange`) — Dia · Semana · Mês · Ano.
- `GoalsChecklist` — checklist de metas (Home).
- `DotsMenu` (`items`) — menu ⋯.
- `EntityRow` + `EntityListFooter` — lista de contas/ativos com avatar quadrado.
- `BarList` (`items`) — barras horizontais com cor por consumo de orçamento.
- `MoneyInput` (`value` centavos, `onChange`).
- `TagsInput` (`value`, `onChange`).

`components/ui/`: `Button` (variants: primary/soft/ghost/outline/dashed/danger),
`Input`, `Textarea`, `Label`, `Checkbox`, `Dialog*`, `Sheet*` (formulários de criar/editar),
`Popover*`, `Select*`, `DropdownMenu*`, `Table`/`THead`/`Th`/`Tr`/`Td`/`StatusPill`.

`components/charts/`: `theme.ts` (cores/axisProps), `ChartTooltip`, `RitmoChart`,
`AreaEvolution`, `Sparkline`.

`lib/`:
- `dates.ts`: `nowSP()`, `fmtSP(date, pattern)`, `fullDate`, `mediumDate`, `timeHM`, `monthYear`,
  `monthName`, `spStartOfDay/Month/Week`, `spEndOf…`, `isSameDaySP`, `dayKeySP`, `monthKeySP`, `toSP`.
- `money.ts`: `formatBRL`, `formatBRLPlain`, `splitBRL`, `formatBRLCompact`, `parseBRL`,
  `percentDiff`, `formatPercent`.
- `recurrence.ts`: `expandEvents(events, from, to)`, `describeRrule`, `parseRrule`, tipo `Rrule`
  (`{freq, byday?, interval?, until?}` serializado em JSON no campo `Event.rrule`).
- `insights.ts`: regras puras + `pickInsight`; `lib/data/insights-server.ts` tem
  `insightDoDia`, `insightFinanceiroPrincipal`, `insightsFinanceiros`.
- `utils.ts`: `cn`, `parseJSON`.
- `lib/data/home.ts`: `getSetting(key, fallback)`, `eventosDeHoje`, `treinosDaSemana`, `kcalHoje`,
  `mediaKcal7d`, `streakCaverna`, `proximoEvento`.
- `lib/data/financas.ts`: `resumoDoMes`, `ritmoDeGastos`, `categoriasComparadas`, `somaDespesas`.

## Dados

O banco está populado (jun/jul 2026, hoje = 16/07/2026). Campos JSON serializados como String
(`tags`, `exdates`, `refeicoesCumpridas`, `extras`) — use `parseJSON` de `lib/utils.ts`.
Datas no banco em UTC; exiba SEMPRE via helpers de `lib/dates.ts`.

## Definição de pronto do seu módulo

- CRUD completo e persistente com server actions + revalidatePath.
- Estados vazio/carregando/erro desenhados.
- Nenhum texto em inglês na UI. `npx tsc --noEmit` limpo.
- Visual: denso em dados, editorial, IDÊNTICO ao design system acima.
