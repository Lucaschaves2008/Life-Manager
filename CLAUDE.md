# MYLIFE (Life-Manager)

Next.js 16 (App Router) + Prisma + Supabase (Auth/Storage), deploy na Vercel.
App **em produção com usuários reais**, repositório **público** no GitHub.

## Segurança — regras inegociáveis (detalhes em SECURITY.md)

- Todo export de arquivo `"use server"` é endpoint público: começa com
  `await requireUser()` / `requireSuperAdmin()`. Nunca recebe `userId` por
  parâmetro — o usuário vem da sessão. Helper que recebe `userId` vai pra
  `lib/` com `import "server-only"`.
- Toda query por id filtra por dono: `where: { id, userId }`. FK vinda do
  cliente é validada como do usuário antes de gravar. Desafios: `requireMembro`/`requireCriador`.
- Nenhum segredo em arquivo versionado; `NEXT_PUBLIC_` nunca é segredo.
- Número do cliente que dirige loop/`createMany` tem teto no servidor; texto livre tem limite de tamanho.
- Upload: MIME + tamanho validados; extensão vem do MIME; arquivo privado = bucket privado + URL assinada.
- Fluxo sensível (login, cadastro, senha, código de convite) usa `consumirLimite` (`lib/rate-limit.ts`).
- OAuth sempre com `state` em cookie httpOnly validado no callback.
- O app NÃO usa a Data API do Supabase (só Prisma). Nunca adicionar
  `supabase.from(...)` no cliente nem conceder grant a `anon`/`authenticated`.
- Modelo novo no Prisma → depois do `db push`, rodar `supabase/seguranca.sql`
  e `node --env-file=.env.local scripts/verificar-banco.mjs`.
- Antes de concluir qualquer mudança: `node scripts/checar-seguranca.mjs`
  (também roda no `prebuild` — o deploy falha se quebrar).
