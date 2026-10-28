# Segurança — MYLIFE (Life-Manager)

App em produção com usuários reais e **repositório público**. Tudo que entra no
git fica exposto para sempre (inclusive no histórico, mesmo depois de apagado).

## Modelo de segurança em uma frase

O navegador nunca fala com o banco. Todo dado passa por **server actions /
route handlers** que resolvem o usuário pela sessão (`requireUser`) e filtram
por `userId`. O Prisma conecta como `postgres` e ignora RLS, então **a
autorização é do código** — e a Data API do Supabase fica fechada para
`anon`/`authenticated` (ver `supabase/seguranca.sql`).

## Regras (o build falha se 1–5 forem violadas — `scripts/checar-seguranca.mjs`)

1. **Todo export de arquivo `"use server"` é um endpoint HTTP público.** A
   primeira linha é `const { id: userId } = await requireUser()` (ou
   `requireSuperAdmin()`). Exceções só no fluxo de login (`app/actions/auth.ts`).
2. **Server action nunca recebe `userId` do cliente.** O usuário vem da sessão.
   Função que precisa de `userId` como parâmetro mora em `lib/` com
   `import "server-only"` — nunca em `app/actions/`.
3. **Todo ID vindo do cliente é hostil.** Escrita/leitura por id usa
   `where: { id, userId }` (ou confere posse antes com `findFirst`). FK vinda
   do cliente (accountId, categoryId, desafioId…) é validada como do usuário
   antes de gravar — ver `validarPosse` em `app/actions/financas.ts`.
4. **Nenhum segredo no código.** Segredos só em `.env.local` (ignorado) e nas
   env vars da Vercel. Prefixo `NEXT_PUBLIC_` = vai pro navegador = nunca
   segredo. A única chave pública legítima é a publishable do Supabase.
5. **Client component não importa** `@/lib/db`, `@/lib/supabase/admin`,
   `@/lib/supabase/storage`, `@/lib/rate-limit`, `@/lib/auth`.
6. **Recursos compartilhados (desafios)**: toda leitura/escrita passa por
   `requireMembro` / `requireCriador`.
7. **Input tem teto.** Loop/`createMany` dirigido por número do cliente tem
   máximo no servidor (ex.: `MAX_PARCELAS`). Texto livre tem `slice` de tamanho.
8. **Upload**: valida MIME + tamanho na action; extensão vem do MIME, nunca do
   nome do arquivo. Arquivo privado → bucket privado + URL assinada.
9. **Fluxo sensível tem rate limit** (`consumirLimite` em `lib/rate-limit.ts`):
   login, cadastro, troca de senha, entrar em desafio por código.
10. **OAuth sempre com `state`** em cookie httpOnly, validado no callback.
11. **Tabela nova no Prisma**: depois do `prisma db push`, rode
    `supabase/seguranca.sql` de novo e `scripts/verificar-banco.mjs`.

## Camadas automáticas

| Onde | O quê |
|---|---|
| `npm run build` (`prebuild`) | `checar-seguranca.mjs` — deploy na Vercel falha se uma regra quebrar |
| `scripts/auto-deploy-watch.mjs` | mesmo guardião antes de cada commit automático |
| GitHub Actions `seguranca.yml` | guardião + gitleaks no histórico + `npm audit` crítico, a cada push e toda segunda |
| Dependabot | PR semanal de atualização de dependências |
| Banco | Data API fechada, RLS em tudo, RLS automático em tabela nova (`supabase/seguranca.sql`) |

## Comandos

```bash
npm run seguranca                                      # guardião + audit
node --env-file=.env.local scripts/verificar-banco.mjs # auditoria read-only do banco
```

## Configurações fora do código (conferir no painel)

- **Supabase → Authentication → Sign In / Providers**: desligar *Allow new users
  to sign up*. O cadastro do app usa a service_role (não é afetado); deixar
  ligado permite criar contas direto na API do Supabase, sem o rate limit do app.
- **Supabase → Authentication → Policies**: senha mínima 8.
- **GitHub → Settings → Code security**: *Secret scanning* e *Push protection*
  ligados (grátis em repo público) — bloqueia o push se tiver segredo.
- **Vercel → env vars**: `SUPABASE_SERVICE_ROLE_KEY`, `STRAVA_CLIENT_SECRET`,
  `GOOGLE_CLIENT_SECRET` marcadas como *Sensitive*.

## Se um segredo vazar

Apagar do código **não resolve** (o histórico é público). Na ordem:
1. Rotacionar a chave no provedor (Supabase → API Keys; senha do banco em
   Database → Settings; Google/Strava no console deles).
2. Atualizar `.env.local` e as env vars da Vercel; redeploy.
3. Só depois limpar o histórico (`git filter-repo`) se fizer sentido.
