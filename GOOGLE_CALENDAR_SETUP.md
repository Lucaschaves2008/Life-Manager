# Google Calendar Integration Setup

Este arquivo documenta como configurar a integração com Google Calendar.

## 1. Criar um Projeto no Google Cloud

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Crie um novo projeto (ex: "Life Manager")
3. Ative a **Calendar API**:
   - Vá para "APIs e Serviços" → "Biblioteca"
   - Procure por "Google Calendar API"
   - Clique em "ATIVAR"

## 2. Criar Credenciais OAuth 2.0

1. Vá para "APIs e Serviços" → "Credenciais"
2. Clique em "Criar Credenciais" → "ID do Cliente OAuth 2.0"
3. Escolha o tipo: **Aplicação Web**
4. Configure os URIs autorizados:
   - **URLs JavaScript autorizados:**
     - `http://localhost:3000`
     - `https://seu-dominio.vercel.app` (quando usar em produção)
   - **URIs de redirecionamento autorizados:**
     - `http://localhost:3000/api/google-calendar/callback`
     - `https://seu-dominio.vercel.app/api/google-calendar/callback` (produção)

5. Copie o **Client ID** e **Client Secret**

## 3. Configurar Variáveis de Ambiente

### Desenvolvimento (.env.local)
```
GOOGLE_CLIENT_ID="seu-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="seu-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/google-calendar/callback"
```

### Produção (Vercel)
```
GOOGLE_CLIENT_ID="seu-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="seu-client-secret"
GOOGLE_REDIRECT_URI="https://seu-dominio.vercel.app/api/google-calendar/callback"
```

## 4. Como Funciona

### Sincronização Unidirecional (App → Google)

Quando você cria/edita/deleta um evento no Life Manager:
- Se o calendário estiver conectado ao Google Calendar
- O evento é automaticamente sincronizado

### Estados

1. **Desconectado**: Sem acesso ao Google Calendar
2. **Conectado**: Credenciais armazenadas, eventos sincronizam automaticamente

## 5. Usar a Integração

1. Abra "Configurações" → "Integrações"
2. Clique em "Conectar" no card de Google Calendar
3. Autorize a aplicação a acessar seu Google Calendar
4. Após autorizar, pronto! Seus eventos começarão a sincronizar

### Desconectar

1. Vá para "Configurações" → "Integrações"
2. Clique em "Desconectar"
3. Seus eventos locais **não serão deletados**, apenas a sincronização será pausada

## 6. Troubleshooting

### Erro: "Google Calendar não está conectado"
- Certifique-se de que você clicou em "Conectar" e autorizou a aplicação

### Erro: "GOOGLE_CLIENT_ID não configurado"
- Verifique se as variáveis de ambiente estão no `.env.local` (dev) ou Vercel (prod)

### Token Expirado
- Os tokens são automaticamente renovados via `refresh_token`
- Nenhuma ação necessária do usuário

## 7. Funcionalidades

✅ Criar eventos → sincroniza com Google Calendar
✅ Editar eventos → atualiza no Google Calendar
✅ Deletar eventos → remove do Google Calendar
✅ Suporta eventos recorrentes (RRULE)
✅ Suporta lembretes
✅ Suporta eventos de dia inteiro
✅ Refresh automático de tokens

## 8. Limitações Conhecidas

❌ Sincronização bidirecional (Google → App) não implementada
❌ Apenas calendário "primary" é suportado
❌ Imagem de capa do evento não sincroniza
❌ Tags customizadas (específicas do app) não sincronizam

## 9. Próximas Melhorias

- [ ] Sincronização bidirecional (importar eventos do Google)
- [ ] Suporte a múltiplos calendários
- [ ] Configuração de qual calendário sincronizar
- [ ] Histórico de sincronização
- [ ] Tratamento de conflitos
