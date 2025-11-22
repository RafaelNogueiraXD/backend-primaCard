# Guia de Instalação e Deployment - PrimaCard Backend

## 📋 Pré-requisitos

### Requisitos de Sistema

- **Node.js**: 18.x ou superior
- **npm**: 9.x ou superior
- **PostgreSQL**: 13.x ou superior
- **Git**: Para controle de versão

### Ferramentas Recomendadas

- **Postman** ou **Insomnia**: Para testar a API
- **pgAdmin** ou **DBeaver**: Para gerenciar o banco
- **VS Code**: Editor recomendado com extensões:
  - Prisma
  - ESLint
  - Prettier

## 🚀 Instalação Local (Desenvolvimento)

### 1. Clonar o Repositório

```bash
git clone <repository-url>
cd backend-primaCard
```

### 2. Instalar Dependências

```bash
npm install
```

### 3. Configurar Banco de Dados PostgreSQL

#### Opção A: PostgreSQL Local

Instale o PostgreSQL e crie um banco:

```sql
CREATE DATABASE primacard;
CREATE USER primacard_user WITH PASSWORD 'sua_senha_segura';
GRANT ALL PRIVILEGES ON DATABASE primacard TO primacard_user;
```

#### Opção B: PostgreSQL com Docker

```bash
docker run --name primacard-postgres \
  -e POSTGRES_DB=primacard \
  -e POSTGRES_USER=primacard_user \
  -e POSTGRES_PASSWORD=sua_senha_segura \
  -p 5432:5432 \
  -d postgres:15
```

### 4. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Edite o `.env` com suas configurações:

```env
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL="postgresql://primacard_user:sua_senha_segura@localhost:5432/primacard?schema=public"

# JWT Secrets (gere strings aleatórias fortes)
JWT_SECRET=seu_jwt_secret_aqui_muito_seguro_com_pelo_menos_32_caracteres
JWT_REFRESH_SECRET=seu_refresh_secret_aqui_tambem_muito_seguro_diferente_do_anterior

# Email (Gmail como exemplo)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu.email@gmail.com
SMTP_PASSWORD=sua_senha_de_app_do_gmail

# Admin
ADMIN_API_KEY=sua_chave_admin_super_secreta

# Frontend (para CORS)
FRONTEND_URL=http://localhost:3001
```

**⚠️ Segurança**: Nunca commite o arquivo `.env`!

### 5. Gerar Secrets Seguros

```bash
# No terminal Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Use a saída para JWT_SECRET e JWT_REFRESH_SECRET.

### 6. Executar Migrations do Banco

```bash
# Gerar cliente Prisma
npm run prisma:generate

# Criar tabelas no banco
npm run prisma:migrate
```

### 7. Popular Banco com Dados Iniciais (Opcional)

```bash
npm run prisma:seed
```

Isso criará:
- 1 usuário admin
- 1 profissional (dentista)
- 3 pacientes de exemplo
- 4 procedimentos
- 4 recompensas

**Credenciais de teste**:
- Admin: `admin@primacard.com` / `Admin123!@#`
- Dentista: `dra.silva@primacard.com` / `Dentista123!`
- Paciente: `joao.santos@email.com` / `Paciente123!`

### 8. Iniciar Servidor

```bash
# Modo desenvolvimento (hot reload)
npm run dev
```

O servidor estará rodando em: `http://localhost:3000`

### 9. Verificar Instalação

Acesse os endpoints:
- Health Check: http://localhost:3000/health
- Swagger Docs: http://localhost:3000/api-docs

## 🧪 Testes

### Executar Todos os Testes

```bash
npm test
```

### Testes em Modo Watch

```bash
npm run test:watch
```

### Coverage

```bash
npm test -- --coverage
```

## 📦 Build para Produção

### 1. Build

```bash
npm run build
```

Isso compilará o TypeScript para JavaScript na pasta `dist/`.

### 2. Executar Build

```bash
npm start
```

## 🌐 Deploy em Produção

### Preparação

#### 1. Checklist de Segurança

- [ ] Alterar todos os secrets em `.env`
- [ ] JWT_SECRET e JWT_REFRESH_SECRET únicos e fortes
- [ ] ADMIN_API_KEY complexa
- [ ] Senha do banco de dados forte
- [ ] SMTP configurado com credenciais reais
- [ ] NODE_ENV=production
- [ ] Rate limiting apropriado
- [ ] CORS configurado para frontend real

#### 2. Otimizações

- [ ] Ativar logs de produção (LOG_LEVEL=info ou warn)
- [ ] Configurar rotação de logs
- [ ] Setup de backup do banco
- [ ] Monitoramento configurado

### Opção A: Deploy com PM2 (VPS/Servidor Dedicado)

#### 1. Instalar PM2

```bash
npm install -g pm2
```

#### 2. Criar arquivo ecosystem

`ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'primacard-api',
    script: './dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
```

#### 3. Deploy

```bash
# Build
npm run build

# Rodar migrations
npm run prisma:migrate

# Iniciar com PM2
pm2 start ecosystem.config.js --env production

# Salvar configuração
pm2 save

# Auto-start no reboot
pm2 startup
```

#### 4. Gerenciar

```bash
# Ver status
pm2 status

# Ver logs
pm2 logs primacard-api

# Restart
pm2 restart primacard-api

# Stop
pm2 stop primacard-api
```

### Opção B: Deploy com Docker

#### 1. Criar Dockerfile

`Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npm run build
RUN npm prune --production

FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]
```

#### 2. Criar docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: primacard_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: primacard
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  api:
    build: .
    environment:
      DATABASE_URL: postgresql://primacard_user:${DB_PASSWORD}@postgres:5432/primacard?schema=public
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      ADMIN_API_KEY: ${ADMIN_API_KEY}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASSWORD: ${SMTP_PASSWORD}
      FRONTEND_URL: ${FRONTEND_URL}
    ports:
      - "3000:3000"
    depends_on:
      - postgres
    restart: unless-stopped

volumes:
  postgres_data:
```

#### 3. Build e Run

```bash
# Build
docker-compose build

# Run
docker-compose up -d

# Ver logs
docker-compose logs -f api

# Executar migrations
docker-compose exec api npm run prisma:migrate
```

### Opção C: Deploy em Cloud Platforms

#### Heroku

1. Instalar Heroku CLI
2. Criar app:

```bash
heroku create primacard-api
heroku addons:create heroku-postgresql:hobby-dev
```

3. Configurar variáveis:

```bash
heroku config:set JWT_SECRET=seu_secret
heroku config:set JWT_REFRESH_SECRET=seu_refresh_secret
heroku config:set ADMIN_API_KEY=sua_chave
# ... outras variáveis
```

4. Deploy:

```bash
git push heroku main
heroku run npm run prisma:migrate
```

#### AWS Elastic Beanstalk

1. Instalar EB CLI
2. Inicializar:

```bash
eb init
eb create primacard-production
```

3. Deploy:

```bash
eb deploy
```

#### DigitalOcean App Platform

1. Conectar repositório no dashboard
2. Configurar build command: `npm run build`
3. Configurar run command: `npm start`
4. Adicionar PostgreSQL managed database
5. Configurar environment variables
6. Deploy automático no push

#### Render

1. Conectar repositório
2. Configurar:
   - Build Command: `npm install && npm run build && npm run prisma:generate`
   - Start Command: `npm run prisma:migrate && npm start`
3. Adicionar PostgreSQL database
4. Configurar environment variables
5. Deploy automático

#### Vercel (Recomendado para desenvolvimento rápido)

**⚠️ Importante**: A Vercel usa serverless functions, então alguns recursos podem ter limitações (ex: cron jobs, websockets).

##### 1. Preparação Local

O projeto já está configurado com os arquivos necessários:
- ✅ `vercel.json` - Configuração de build e rotas
- ✅ `api/index.ts` - Entry point serverless
- ✅ `.vercelignore` - Arquivos ignorados no deploy

##### 2. Instalar Vercel CLI (Opcional)

```bash
npm install -g vercel
```

##### 3. Deploy via CLI

```bash
# Login na Vercel
vercel login

# Deploy em preview
vercel

# Deploy em produção
vercel --prod
```

##### 4. Deploy via Dashboard (Mais fácil)

1. **Conectar Repositório**:
   - Acesse https://vercel.com/new
   - Importe seu repositório do GitHub/GitLab/Bitbucket

2. **Configurar Build**:
   - Framework Preset: `Other`
   - Build Command: `npm run vercel-build`
   - Output Directory: (deixe vazio)
   - Install Command: `npm install`

3. **Adicionar Database PostgreSQL**:
   - Opção 1: Usar Vercel Postgres (integrado)
   - Opção 2: Usar Neon, Supabase, ou outro provider externo

4. **Configurar Variáveis de Ambiente**:
   
   Vá em Settings > Environment Variables e adicione:

   ```env
   DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
   JWT_SECRET=seu_jwt_secret_muito_seguro_com_pelo_menos_32_caracteres
   JWT_REFRESH_SECRET=seu_refresh_secret_diferente_e_seguro
   ADMIN_API_KEY=sua_chave_admin_super_secreta
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=seu.email@gmail.com
   SMTP_PASSWORD=sua_senha_de_app
   FRONTEND_URL=https://seuapp.vercel.app
   NODE_ENV=production
   ```

5. **Deploy**:
   - Click em "Deploy"
   - Vercel irá automaticamente:
     - Instalar dependências
     - Gerar Prisma Client
     - Executar migrations (`prisma migrate deploy`)
     - Fazer build da aplicação

6. **Verificar Deploy**:
   - URL gerada: `https://seu-projeto.vercel.app`
   - Health check: `https://seu-projeto.vercel.app/health`
   - API Docs: `https://seu-projeto.vercel.app/api-docs`

##### 5. Database Setup (Vercel Postgres)

Se usar Vercel Postgres integrado:

```bash
# Instalar Vercel Postgres SDK
npm install @vercel/postgres

# A DATABASE_URL será automaticamente injetada
```

No Vercel Dashboard:
1. Storage > Create Database > Postgres
2. Connect to Project
3. DATABASE_URL será adicionada automaticamente

##### 6. Database Setup (Provider Externo - Recomendado)

**Neon** (Serverless PostgreSQL - Grátis):

1. Criar conta em https://neon.tech
2. Criar novo projeto
3. Copiar connection string
4. Adicionar em Vercel: `DATABASE_URL=postgresql://...`

**Supabase**:

1. Criar conta em https://supabase.com
2. Criar novo projeto
3. Settings > Database > Connection string
4. Usar connection pooling: `...?pgbouncer=true`

##### 7. Migrations

```bash
# Primeira vez - executar migrations
npx prisma migrate deploy

# Ou via Vercel CLI
vercel env pull .env.local
npm run prisma:migrate:deploy
```

##### 8. Monitoramento

Vercel fornece:
- **Logs**: https://vercel.com/dashboard/[seu-projeto]/logs
- **Analytics**: Métricas de uso e performance
- **Errors**: Tracking automático de erros

##### 9. Custom Domain

1. Ir em Settings > Domains
2. Adicionar seu domínio: `api.primacard.com`
3. Configurar DNS (Vercel fornece instruções)
4. SSL automático com Let's Encrypt

##### 10. Limitações da Vercel

**Atenção para**:
- ⚠️ **Timeout**: 10s (Hobby), 60s (Pro) para cada request
- ⚠️ **Cron Jobs**: Não suportado nativamente (use Vercel Cron)
- ⚠️ **WebSockets**: Não suportado
- ⚠️ **Uploads**: Limite de 4.5MB body size
- ⚠️ **Cold Starts**: Primeira request após inatividade é mais lenta

**Soluções**:
- Para cron jobs: Use Vercel Cron ou serviços externos (cron-job.org)
- Para WebSockets: Use serviço separado (Pusher, Ably)
- Para uploads grandes: Use cloud storage (S3, Cloudinary)

##### 11. Vercel Cron (Para Jobs Agendados)

Criar `vercel.json` com crons:

```json
{
  "crons": [
    {
      "path": "/api/v1/cron/expire-redemptions",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/v1/cron/send-reminders",
      "schedule": "0 8 * * *"
    }
  ]
}
```

Criar rotas de cron protegidas em `src/modules/cron/`:

```typescript
// Verificar header da Vercel
if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

##### 12. Troubleshooting Vercel

**Build falha**:
```bash
# Verificar logs no dashboard
# Testar build localmente
npm run vercel-build
```

**Database não conecta**:
- Verificar DATABASE_URL tem `?sslmode=require`
- Verificar IP whitelist no provider de DB
- Testar connection string localmente

**Cold start lento**:
- Usar Vercel Pro para warm instances
- Otimizar imports (tree-shaking)
- Usar Edge Functions para rotas simples

**Environment variables não funcionam**:
- Redeploy após adicionar variáveis
- Verificar scope (Production/Preview/Development)

##### 13. Deploy Automático

**GitHub Integration**:
- Push para `main` → Deploy em produção
- Pull Request → Deploy preview
- Branch → Deploy preview

**Configurar branches**:
1. Settings > Git
2. Production Branch: `main`
3. Preview branches: `develop`, `staging`

### Opção E: Deploy em Kubernetes

#### 1. Criar deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: primacard-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: primacard-api
  template:
    metadata:
      labels:
        app: primacard-api
    spec:
      containers:
      - name: api
        image: your-registry/primacard-api:latest
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: primacard-secrets
---
apiVersion: v1
kind: Service
metadata:
  name: primacard-api-service
spec:
  selector:
    app: primacard-api
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: LoadBalancer
```

#### 2. Deploy

```bash
kubectl apply -f deployment.yaml
```

## 🔧 Configuração de Nginx (Reverse Proxy)

Para produção, use Nginx na frente:

```nginx
server {
    listen 80;
    server_name api.primacard.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Configurar SSL com Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.primacard.com
```

## 📊 Monitoramento

### Logs

Visualizar logs em produção:

```bash
# PM2
pm2 logs

# Docker
docker-compose logs -f api

# Arquivos diretos
tail -f logs/combined.log
tail -f logs/error.log
```

### Métricas

Ferramentas recomendadas:
- **New Relic**: APM completo
- **Datadog**: Monitoramento e logs
- **Sentry**: Error tracking
- **Prometheus + Grafana**: Métricas customizadas

## 🔄 Backup e Recuperação

### Backup do Banco (PostgreSQL)

```bash
# Backup
pg_dump -U primacard_user -d primacard > backup_$(date +%Y%m%d).sql

# Restore
psql -U primacard_user -d primacard < backup_20250117.sql
```

### Backup Automatizado

Cron job para backup diário:

```bash
0 2 * * * pg_dump -U primacard_user -d primacard | gzip > /backups/primacard_$(date +\%Y\%m\%d).sql.gz
```

## 🔐 SSL/TLS

### Let's Encrypt (Grátis)

```bash
sudo certbot --nginx -d api.primacard.com
```

### CloudFlare

1. Adicionar domínio no CloudFlare
2. Configurar DNS
3. Ativar SSL/TLS (Full ou Full Strict)
4. Ativar Always Use HTTPS

## 📈 Escalabilidade

### Horizontal Scaling

1. **Load Balancer**: Nginx, HAProxy, ou cloud LB
2. **Múltiplas instâncias**: PM2 cluster mode ou containers
3. **Session storage**: Redis para sessões compartilhadas
4. **Database**: Connection pooling adequado

### Vertical Scaling

1. Aumentar recursos do servidor
2. Otimizar queries (EXPLAIN ANALYZE)
3. Adicionar índices necessários
4. Configurar cache

## 🚨 Troubleshooting

### Problema: Não conecta ao banco

```bash
# Verificar se PostgreSQL está rodando
sudo systemctl status postgresql

# Testar conexão
psql -U primacard_user -d primacard -h localhost
```

### Problema: Migrations falham

```bash
# Reset database (⚠️ CUIDADO EM PRODUÇÃO!)
npx prisma migrate reset

# Ou criar nova migration
npx prisma migrate dev --name fix_issue
```

### Problema: Porta já em uso

```bash
# Encontrar processo usando a porta
lsof -i :3000

# Matar processo
kill -9 <PID>
```

### Problema: Out of Memory

Aumentar limite do Node.js:

```bash
node --max-old-space-size=4096 dist/server.js
```

## 📞 Suporte

Para problemas ou dúvidas:
1. Consulte a documentação
2. Verifique logs
3. Abra uma issue no repositório

---

**Última atualização**: 2025-01-17
