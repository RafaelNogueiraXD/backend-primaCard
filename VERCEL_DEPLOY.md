# 🚀 Deploy na Vercel - PrimaCard API

## Configuração Rápida

### 1️⃣ Preparar Database

**Recomendado: Neon (PostgreSQL Serverless)**

1. Criar conta em https://neon.tech
2. Criar novo projeto
3. Copiar connection string (com pooling):
   ```
   postgresql://user:password@host/database?sslmode=require&pgbouncer=true
   ```

### 2️⃣ Deploy na Vercel

#### Via Dashboard (Mais Fácil)

1. **Importar Projeto**:
   - https://vercel.com/new
   - Conectar GitHub/GitLab/Bitbucket
   - Selecionar repositório

2. **Configurações**:
   - Framework: `Other`
   - Build Command: `npm run vercel-build`
   - Output Directory: (vazio)
   - Install Command: `npm install`

3. **Environment Variables**:
   
   Adicionar em Settings > Environment Variables:

   ```env
   # Database (Neon, Supabase, ou outro)
   DATABASE_URL=postgresql://user:password@host/database?sslmode=require&pgbouncer=true

   # JWT Secrets (gerar com: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
   JWT_SECRET=seu_jwt_secret_muito_seguro_64_caracteres_minimo
   JWT_REFRESH_SECRET=seu_refresh_secret_diferente_64_caracteres_minimo

   # Admin
   ADMIN_API_KEY=sua_chave_admin_super_secreta

   # Email (Gmail)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=seu.email@gmail.com
   SMTP_PASSWORD=sua_senha_de_app_do_gmail

   # CORS
   FRONTEND_URL=https://seu-frontend.vercel.app

   # Environment
   NODE_ENV=production
   ```

4. **Deploy**: Click em "Deploy" ✨

#### Via CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy preview
vercel

# Deploy produção
vercel --prod
```

### 3️⃣ Executar Migrations

**Primeira vez** (antes ou depois do deploy):

```bash
# Baixar variáveis de ambiente da Vercel
vercel env pull .env.production

# Executar migrations
npx prisma migrate deploy

# Ou seed inicial
npx prisma db seed
```

**Automático**: O comando `vercel-build` no package.json já executa `prisma migrate deploy`.

### 4️⃣ Testar Deploy

Após deploy concluído:

```bash
# Health check
curl https://seu-projeto.vercel.app/health

# API Docs
open https://seu-projeto.vercel.app/api-docs

# Login
curl -X POST https://seu-projeto.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@primacard.com","password":"Admin123!@#"}'
```

## 📋 Checklist Pré-Deploy

- [ ] Database PostgreSQL configurado (Neon, Supabase, etc.)
- [ ] Todas as variáveis de ambiente configuradas na Vercel
- [ ] JWT_SECRET e JWT_REFRESH_SECRET fortes e únicos
- [ ] SMTP configurado para emails
- [ ] FRONTEND_URL apontando para frontend correto
- [ ] Migrations aplicadas no banco de produção
- [ ] Testado localmente com as mesmas env vars

## 🔒 Segurança

### Gerar Secrets Seguros

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# JWT_REFRESH_SECRET (gere outro diferente)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ADMIN_API_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### SMTP com Gmail

1. Ativar 2FA na conta Google
2. Gerar senha de app: https://myaccount.google.com/apppasswords
3. Usar senha gerada em `SMTP_PASSWORD`

## 🗄️ Opções de Database

### Neon (Recomendado) ⭐

- ✅ Serverless PostgreSQL
- ✅ Free tier generoso
- ✅ Connection pooling integrado
- ✅ Backups automáticos
- 🔗 https://neon.tech

Connection string:
```
postgresql://user:pass@host/db?sslmode=require&pgbouncer=true
```

### Supabase

- ✅ PostgreSQL + Backend
- ✅ Free tier bom
- ✅ Dashboard de gerenciamento
- 🔗 https://supabase.com

Connection string (usar pooling):
```
postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:6543/postgres?pgbouncer=true
```

### Vercel Postgres

- ✅ Integrado com Vercel
- ⚠️ Mais caro
- 🔗 Via Vercel Dashboard > Storage

### Railway

- ✅ PostgreSQL simples
- ✅ Free tier
- 🔗 https://railway.app

## ⚡ Performance

### Cold Starts

Primeira request após inatividade (~5-10s):
- Inevitável no free tier
- Vercel Pro tem instâncias warm
- Minimizar imports pesados

### Otimizações

```typescript
// Lazy load módulos pesados
const heavyModule = await import('./heavy');

// Use Edge Functions para rotas simples
export const config = { runtime: 'edge' };
```

## 🔄 CI/CD Automático

Vercel detecta automaticamente pushes:

- `main` branch → Deploy produção
- Pull Requests → Deploy preview
- Outros branches → Deploy preview

### Bloquear Deploys Quebrados

Adicionar ao `.github/workflows/test.yml`:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
```

## 📊 Monitoramento

### Logs

```bash
# Via CLI
vercel logs seu-projeto

# Via Dashboard
https://vercel.com/[usuario]/[projeto]/logs
```

### Analytics

Vercel fornece:
- Requests/segundo
- Response time
- Error rate
- Geographic distribution

## 🚨 Troubleshooting

### Build Falha

```bash
# Testar build localmente
npm run vercel-build

# Ver logs detalhados
vercel logs --follow
```

### Database Connection Errors

```bash
# Verificar connection string
echo $DATABASE_URL

# Testar conexão
npx prisma db pull
```

### Environment Variables Não Funcionam

1. Redeploy após adicionar variáveis
2. Verificar scope (Production/Preview/Development)
3. Pull vars localmente: `vercel env pull`

### Prisma Generate Fails

```bash
# Garantir que está no vercel-build
npm run vercel-build

# Verificar se prisma está em dependencies (não devDependencies)
```

## ⚠️ Limitações Importantes

| Feature | Vercel Hobby | Vercel Pro |
|---------|--------------|------------|
| Request Timeout | 10s | 60s |
| Build Timeout | 45min | 45min |
| Bandwidth | 100GB/mês | 1TB/mês |
| Serverless Functions | 12 simultâneas | 100 simultâneas |
| Cron Jobs | ❌ Native, ✅ Workaround | ✅ Vercel Cron |
| WebSockets | ❌ | ❌ |

### Workarounds

**Cron Jobs**: Use serviço externo (cron-job.org) chamando endpoints protegidos:

```typescript
// src/modules/cron/cron.controller.ts
export const expireRedemptions = async (req, res) => {
  // Verificar token secreto
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Lógica do cron...
};
```

**WebSockets**: Use Pusher, Ably, ou Socket.io em servidor separado

**Long Running Tasks**: Use fila externa (BullMQ + Redis)

## 🌐 Custom Domain

1. Vercel Dashboard > Settings > Domains
2. Add domain: `api.primacard.com`
3. Configurar DNS:
   ```
   CNAME api.primacard.com -> cname.vercel-dns.com
   ```
4. SSL automático (Let's Encrypt)

## 📚 Recursos

- 📖 Docs Vercel: https://vercel.com/docs
- 🎓 Deploy Node.js: https://vercel.com/docs/frameworks/node
- 🗄️ Prisma + Vercel: https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel
- 💬 Community: https://github.com/vercel/vercel/discussions

## 🆘 Suporte

1. Verificar logs no dashboard
2. Testar localmente com as mesmas env vars
3. Consultar documentação da Vercel
4. GitHub Issues do projeto

---

**Última atualização**: Novembro 2025
