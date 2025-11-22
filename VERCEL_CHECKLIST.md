# ✅ Checklist de Deploy - PrimaCard API na Vercel

Use este checklist para garantir um deploy sem problemas!

## 📋 Pré-Deploy

### Preparação Local
- [ ] Código commitado e pusheado no GitHub/GitLab
- [ ] Arquivo `vercel.json` presente
- [ ] Arquivo `api/index.ts` presente
- [ ] `.vercelignore` configurado
- [ ] `package.json` tem script `vercel-build`
- [ ] Testado localmente com `npm run dev`
- [ ] Build funciona: `npm run build`

### Database Setup
- [ ] Conta criada em Neon/Supabase
- [ ] Database PostgreSQL criado
- [ ] Connection string copiada (com `?sslmode=require&pgbouncer=true`)
- [ ] Testado connection string localmente

### Secrets Gerados
- [ ] JWT_SECRET gerado (64+ caracteres)
- [ ] JWT_REFRESH_SECRET gerado (64+ caracteres, diferente do JWT_SECRET)
- [ ] ADMIN_API_KEY gerado (32+ caracteres)
- [ ] Todos salvos em local seguro (password manager)

### Email Setup (Gmail)
- [ ] 2FA ativado na conta Google
- [ ] Senha de app gerada em https://myaccount.google.com/apppasswords
- [ ] Senha de app copiada (16 caracteres com espaços)

## 🚀 Deploy na Vercel

### Importar Projeto
- [ ] Login em https://vercel.com
- [ ] Click em "Add New" > "Project"
- [ ] Conectar GitHub/GitLab/Bitbucket
- [ ] Selecionar repositório `backend-primaCard`

### Configurar Build
- [ ] Framework: `Other`
- [ ] Build Command: `npm run vercel-build`
- [ ] Output Directory: (vazio)
- [ ] Install Command: `npm install`
- [ ] Root Directory: (vazio)

### Environment Variables
Adicionar TODAS as variáveis (Settings > Environment Variables):

- [ ] `DATABASE_URL` → Connection string do Neon
- [ ] `JWT_SECRET` → Secret gerado
- [ ] `JWT_REFRESH_SECRET` → Outro secret gerado
- [ ] `ADMIN_API_KEY` → Secret admin
- [ ] `SMTP_HOST` → `smtp.gmail.com`
- [ ] `SMTP_PORT` → `587`
- [ ] `SMTP_USER` → Seu email Gmail
- [ ] `SMTP_PASSWORD` → Senha de app do Gmail
- [ ] `FRONTEND_URL` → URL do frontend (ou `*` temporariamente)
- [ ] `NODE_ENV` → `production`

**Scope**: Selecionar "Production", "Preview", e "Development"

### Deploy
- [ ] Click em "Deploy"
- [ ] Aguardar build completar (2-5 min)
- [ ] Deploy successful! 🎉

## ✅ Pós-Deploy

### Verificação Básica
- [ ] Health check responde: `curl https://seu-projeto.vercel.app/health`
- [ ] Swagger acessível: https://seu-projeto.vercel.app/api-docs
- [ ] HTTPS funcionando (cadeado verde)
- [ ] Sem erros no console do navegador

### Testar Endpoints

#### 1. Registro
```bash
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
- [ ] Status 201 retornado
- [ ] `accessToken` presente na resposta

#### 2. Login
```bash
curl -X POST https://seu-projeto.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@primacard.com",
    "password": "Admin123!@#"
  }'
```
- [ ] Status 200 retornado
- [ ] `accessToken` e `refreshToken` presentes

#### 3. Endpoint Protegido
```bash
curl https://seu-projeto.vercel.app/api/v1/auth/me \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```
- [ ] Status 200 retornado
- [ ] Dados do usuário presentes

#### 4. Testar CORS
```bash
curl -X OPTIONS https://seu-projeto.vercel.app/api/v1/auth/login \
  -H "Origin: https://seu-frontend.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -v
```
- [ ] Header `Access-Control-Allow-Origin` presente
- [ ] Sem erros CORS

### Database
- [ ] Migrations aplicadas (verificar no dashboard do Neon)
- [ ] Tabelas criadas (19 tabelas esperadas)
- [ ] Usuário admin criado no banco

### Monitoramento
- [ ] Logs acessíveis no dashboard da Vercel
- [ ] Sem erros nos logs
- [ ] Response time < 1s (primeira request pode ser ~5s cold start)

### Postman Collection
- [ ] Importar `postman_collection.json`
- [ ] Atualizar variável `base_url` para `https://seu-projeto.vercel.app/api/v1`
- [ ] Testar login e obter token
- [ ] Testar 5 endpoints diferentes
- [ ] Todos funcionando ✅

## 🔒 Segurança

### Checklist de Segurança
- [ ] Secrets únicos (não usar exemplos!)
- [ ] `.env` NÃO commitado no Git
- [ ] Secrets diferentes para dev/staging/prod
- [ ] CORS configurado para frontend específico (não `*`)
- [ ] Rate limiting ativo
- [ ] HTTPS forçado
- [ ] Headers de segurança (helmet) ativos

### Verificar Headers de Segurança
```bash
curl -I https://seu-projeto.vercel.app/health
```
Verificar presença de:
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: SAMEORIGIN`
- [ ] `Strict-Transport-Security`
- [ ] `X-XSS-Protection`

## 📊 Performance

### Métricas Esperadas
- [ ] Cold start: < 10s (primeira request após inatividade)
- [ ] Warm response: < 500ms
- [ ] Database query: < 100ms
- [ ] Health check: < 50ms

### Otimizações Aplicadas
- [ ] Connection pooling no database (pgbouncer)
- [ ] Prisma generate no build
- [ ] Compressão ativa
- [ ] Rate limiting configurado

## 🌐 Custom Domain (Opcional)

### Setup
- [ ] Domínio registrado (ex: api.primacard.com)
- [ ] Adicionado em Vercel: Settings > Domains
- [ ] DNS configurado (CNAME para cname.vercel-dns.com)
- [ ] SSL provisionado automaticamente
- [ ] Certificado válido (verificar no navegador)

### Atualizar
- [ ] `FRONTEND_URL` ajustado para domínio real
- [ ] Postman Collection atualizado com domínio
- [ ] Documentação atualizada

## 📱 Integração Frontend

### Configurar CORS
- [ ] `FRONTEND_URL` apontando para domínio correto
- [ ] Testar requests do frontend
- [ ] Cookies/credentials funcionando
- [ ] Sem erros CORS no console

### Testar Fluxo Completo
- [ ] Registro de usuário via frontend
- [ ] Login via frontend
- [ ] Chamadas autenticadas funcionando
- [ ] Refresh token funcionando
- [ ] Logout funcionando

## 🔄 CI/CD

### Git Integration
- [ ] Vercel conectado ao repositório
- [ ] Push para `main` → Deploy produção automático
- [ ] Pull Request → Deploy preview automático
- [ ] Notificações configuradas

### Branch Strategy
- [ ] Branch `main` → Produção
- [ ] Branch `develop` → Staging/Preview
- [ ] Feature branches → Preview URLs

## 📚 Documentação

### Atualizar Docs
- [ ] README.md atualizado com URL de produção
- [ ] DEPLOYMENT.md revisado
- [ ] Postman Collection atualizado
- [ ] Environment variables documentadas

### Compartilhar
- [ ] URL da API compartilhada com time
- [ ] URL do Swagger compartilhada
- [ ] Credenciais de teste fornecidas
- [ ] Guia de uso básico criado

## 🆘 Troubleshooting

### Se algo der errado:

#### Build Falha
1. [ ] Ver logs no dashboard da Vercel
2. [ ] Testar `npm run vercel-build` localmente
3. [ ] Verificar `package.json` e scripts
4. [ ] Verificar `vercel.json` sintaxe

#### Database Connection Error
1. [ ] Verificar `DATABASE_URL` tem `?sslmode=require`
2. [ ] Testar connection string localmente: `npx prisma db pull`
3. [ ] Verificar IP whitelist no provider (0.0.0.0/0 para Vercel)
4. [ ] Verificar database existe

#### 404 em Todas Rotas
1. [ ] Verificar `vercel.json` existe
2. [ ] Verificar `api/index.ts` existe
3. [ ] Verificar rotas em `src/app.ts`

#### CORS Errors
1. [ ] Verificar `FRONTEND_URL` correto
2. [ ] Verificar origem no frontend
3. [ ] Verificar headers no response

#### Prisma Errors
1. [ ] Verificar `prisma generate` executado
2. [ ] Verificar migrations aplicadas: `npx prisma migrate deploy`
3. [ ] Verificar schema.prisma correto

## 🎉 Deploy Completo!

Se todos os checkboxes acima estão marcados:

### ✅ API está no ar e funcionando!
- 🌐 URL: https://seu-projeto.vercel.app
- 📚 Docs: https://seu-projeto.vercel.app/api-docs
- 💚 Health: https://seu-projeto.vercel.app/health

### 📈 Próximos Passos
- [ ] Monitorar logs e performance
- [ ] Configurar alertas (Sentry, etc.)
- [ ] Setup de backup do database
- [ ] Documentar API para usuários finais
- [ ] Implementar analytics
- [ ] Testar sob carga

---

**Parabéns! 🚀 Sua API PrimaCard está em produção!**

Para dúvidas, consulte:
- 📖 [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md) - Guia completo
- 🚀 [QUICKSTART_VERCEL.md](./QUICKSTART_VERCEL.md) - Quick start
- 📚 [DEPLOYMENT.md](./DEPLOYMENT.md) - Outras opções de deploy
