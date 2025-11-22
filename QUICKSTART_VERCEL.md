# 🚀 Quick Start - Deploy Vercel

## Pré-requisitos Rápidos (5 minutos)

### 1. Database Setup (Neon - Grátis)

```bash
# 1. Criar conta: https://neon.tech
# 2. Criar projeto: "primacard-production"
# 3. Copiar connection string com pooling
```

Sua connection string deve ser:
```
postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/primacard?sslmode=require&pgbouncer=true
```

### 2. Gerar Secrets

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# JWT_REFRESH_SECRET (gere outro diferente!)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ADMIN_API_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Salve os 3 valores gerados!

### 3. Configurar Gmail SMTP

```bash
# 1. Ativar 2FA: https://myaccount.google.com/security
# 2. Gerar senha de app: https://myaccount.google.com/apppasswords
#    - App: "Mail"
#    - Device: "PrimaCard API"
# 3. Copiar senha gerada (16 caracteres)
```

## Deploy em 3 Passos

### Passo 1: Importar no Vercel

1. Acesse: https://vercel.com/new
2. Conecte GitHub/GitLab/Bitbucket
3. Selecione o repositório `backend-primaCard`
4. **NÃO clique em Deploy ainda!**

### Passo 2: Configurar Build

```
Framework Preset: Other
Build Command: npm run vercel-build
Output Directory: (deixe vazio)
Install Command: npm install
Root Directory: (deixe vazio)
```

### Passo 3: Adicionar Environment Variables

Clique em "Environment Variables" e adicione:

| Name | Value | Example |
|------|-------|---------|
| `DATABASE_URL` | Connection string do Neon | `postgresql://user:pass@...` |
| `JWT_SECRET` | Secret gerado (64 chars) | `abc123def456...` |
| `JWT_REFRESH_SECRET` | Outro secret (64 chars) | `xyz789uvw012...` |
| `ADMIN_API_KEY` | Secret gerado (32 chars) | `admin123secret456...` |
| `SMTP_HOST` | `smtp.gmail.com` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` | `587` |
| `SMTP_USER` | Seu email Gmail | `seu@gmail.com` |
| `SMTP_PASSWORD` | Senha de app Gmail | `abcd efgh ijkl mnop` |
| `FRONTEND_URL` | URL do frontend | `https://app.vercel.app` |
| `NODE_ENV` | `production` | `production` |

✅ Agora clique em **Deploy**!

## Após Deploy

### 1. Testar API

```bash
# Sua URL será algo como: https://seu-projeto.vercel.app

# Health check
curl https://seu-projeto.vercel.app/health

# API Docs
open https://seu-projeto.vercel.app/api-docs
```

### 2. Criar Usuário Admin

```bash
# Via Postman ou curl
curl -X POST https://seu-projeto.vercel.app/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@primacard.com",
    "password": "Admin123!@#",
    "firstName": "Admin",
    "lastName": "System",
    "phone": "11999999999",
    "role": "ADMIN"
  }'
```

### 3. Fazer Login

```bash
curl -X POST https://seu-projeto.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@primacard.com",
    "password": "Admin123!@#"
  }'
```

Copie o `accessToken` retornado!

### 4. Testar Endpoint Protegido

```bash
curl https://seu-projeto.vercel.app/api/v1/auth/me \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI"
```

## 🎉 Pronto!

Sua API está no ar:
- 🌐 API: `https://seu-projeto.vercel.app`
- 📚 Docs: `https://seu-projeto.vercel.app/api-docs`
- 💚 Health: `https://seu-projeto.vercel.app/health`

## Deploy Futuro (Automático)

```bash
# Apenas faça push!
git add .
git commit -m "nova feature"
git push origin main

# Vercel detecta automaticamente e faz deploy
# Preview URLs para Pull Requests
```

## Troubleshooting Rápido

### Build falha?
```bash
# Testar localmente
npm run vercel-build
```

### Database não conecta?
- Verificar se URL tem `?sslmode=require`
- Verificar se database existe no Neon

### Email não envia?
- Verificar se 2FA está ativado no Gmail
- Verificar se senha é "senha de app" (não senha normal)

### 404 em todas rotas?
- Verificar se `vercel.json` existe
- Verificar se `api/index.ts` existe

## Logs e Monitoramento

```bash
# Via CLI
vercel logs seu-projeto --follow

# Via Dashboard
# https://vercel.com/[usuario]/[projeto]/logs
```

## Custom Domain

```bash
# Via CLI
vercel domains add api.primacard.com

# Via Dashboard
# Settings > Domains > Add Domain
```

## Comandos Úteis

```bash
# Ver ambiente de produção
vercel env ls

# Baixar env vars localmente
vercel env pull .env.production

# Ver logs em tempo real
vercel logs --follow

# Rollback para deploy anterior
vercel rollback [deployment-url]

# Remover projeto
vercel remove seu-projeto
```

## Links Importantes

- 📖 Docs Vercel: https://vercel.com/docs
- 🗄️ Neon Docs: https://neon.tech/docs
- 📧 Gmail App Passwords: https://myaccount.google.com/apppasswords
- 🎯 Dashboard: https://vercel.com/dashboard

---

**Dúvidas?** Consulte [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md) para guia completo!
