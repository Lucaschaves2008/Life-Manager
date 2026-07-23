# Migração do banco: Oregon (us-west-2) → São Paulo (sa-east-1)

**Por quê:** o projeto Supabase atual roda em `aws-1-us-west-2` (Oregon). Cada
query paga ~150–200ms de ida e volta a partir do Brasil (medido). Em São Paulo
cai para ~10–20ms — é a maior alavanca de latência restante do sistema.

A Supabase **não move projeto de região**: cria-se um projeto novo em
`sa-east-1` e migra-se os dados (banco + usuários de auth + storage).
Tempo estimado: ~40 min. Faça num momento sem uso do app.

## 0. Pré-requisitos (uma vez)

```sh
brew install supabase/tap/supabase libpq
     # disponibiliza psql/pg_dump no PATH
```

## 1. Criar o projeto novo

No dashboard da Supabase → **New project**:
- Organização: a mesma · Região: **South America (São Paulo)**
- Guarde a senha do banco e o **project ref** novo (ex.: `abcd1234...`).

Depois, no projeto novo:
- **Settings → API**: copie `URL`, `publishable key` e `service_role key`.
- **Settings → Auth → JWT keys**: clique em **Migrate to asymmetric keys /
  ES256** (essencial — é o que permite validar JWT localmente sem rede; o
  projeto antigo já usa ES256).
- **Storage**: crie o bucket `avatars` (público, igual ao atual).

## 2. Exportar do projeto antigo

Use a `DIRECT_URL` antiga (porta 5432, host `db.cgdxoovnffdzvdgkwjej.supabase.co`):

```sh
supabase db dump --db-url "$OLD_DIRECT_URL" -f roles.sql --role-only
supabase db dump --db-url "$OLD_DIRECT_URL" -f schema.sql
supabase db dump --db-url "$OLD_DIRECT_URL" -f data.sql --use-copy --data-only
```

Isso inclui os schemas `auth` (usuários + hashes de senha) e `public` (todos
os dados do app).

## 3. Importar no projeto novo

Com a `DIRECT_URL` do projeto novo:

```sh
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$NEW_DIRECT_URL"
```

## 4. Storage (avatares)

Poucos arquivos: baixe do bucket `avatars` antigo e re-suba no novo pelo
dashboard (ou peça ao Claude para fazer via API com as duas service keys).
As URLs gravadas em `Profile.avatarUrl` apontam para o domínio antigo —
depois da migração, re-subir a foto pela tela de Configurações resolve.

## 5. Trocar as variáveis de ambiente

Em `.env` e `.env.local` (e depois no Vercel):

```
DATABASE_URL="postgresql://postgres.<REF_NOVO>:<SENHA>@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5"
DIRECT_URL="postgresql://postgres:<SENHA>@db.<REF_NOVO>.supabase.co:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://<REF_NOVO>.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="<nova publishable>"
SUPABASE_SERVICE_ROLE_KEY="<nova service_role>"
```

## 6. Validar

```sh
npx prisma db push        # deve dizer "already in sync"
npm run dev               # logar (sessões antigas caem — login de novo é esperado)
```

Checklist: login funciona · Home carrega com dados · criar/editar transação ·
sino de notificações · conectar Strava de novo (tokens antigos continuam
válidos — a tabela StravaAccount migrou junto).

## 7. Depois

- Pausar (não deletar ainda) o projeto antigo por uma semana de segurança.
- No deploy da Vercel: fixar a região das functions em **gru1 (São Paulo)**
  (Project Settings → Functions → Region) para servidor↔banco < 5ms.
