# PrimaCard Backend API

Backend completo para o sistema PrimaCard - plataforma de agendamento de consultas e recompensas para profissionais da saúde e pacientes.

## 📋 Sobre o Projeto

O PrimaCard é um sistema que permite criar um relacionamento gamificado entre pacientes e profissionais da saúde através de:

- **Agendamento de consultas** com validação de disponibilidade
- **Sistema de pontos** com buckets gerais e específicos por categoria
- **Recompensas** que podem ser resgatadas com pontos
- **Avaliações mútuas** entre pacientes e profissionais
- **Indicações (Referrals)** com recompensas
- **Controle de pontualidade** com tolerância configurável
- **Políticas de cancelamento** e penalidades

## 🛠️ Tecnologias

- **Node.js** + **TypeScript**
- **Express.js** - Framework web
- **Prisma** - ORM para PostgreSQL
- **JWT** - Autenticação
- **bcryptjs** - Hash de senhas
- **node-cron** - Jobs agendados
- **Winston** - Logs
- **Swagger** - Documentação da API
- **Jest** - Testes

## 📦 Estrutura do Projeto

```
backend-primaCard/
├── prisma/
│   ├── schema.prisma          # Schema do banco de dados
│   ├── migrations/            # Migrations do Prisma
│   └── seed.ts                # Dados iniciais
├── src/
│   ├── config/                # Configurações
│   │   ├── index.ts
│   │   ├── database.ts
│   │   └── logger.ts
│   ├── middleware/            # Middlewares
│   │   ├── auth.ts
│   │   ├── validation.ts
│   │   ├── errorHandler.ts
│   │   └── adminAuth.ts
│   ├── modules/               # Módulos da aplicação
│   │   ├── auth/
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.controller.ts
│   │   │   └── auth.routes.ts
│   │   ├── appointments/
│   │   ├── points/
│   │   ├── rewards/
│   │   ├── procedures/
│   │   ├── reviews/
│   │   ├── referrals/
│   │   └── notifications/
│   ├── jobs/                  # Jobs agendados
│   │   └── scheduledJobs.ts
│   ├── types/                 # Tipos TypeScript
│   ├── utils/                 # Utilitários
│   ├── app.ts                 # Configuração do Express
│   └── server.ts              # Entry point
├── .env.example               # Exemplo de variáveis de ambiente
├── package.json
├── tsconfig.json
└── README.md
```

## 🚀 Instalação e Setup

### Pré-requisitos

- Node.js 18+ 
- PostgreSQL 13+
- npm ou yarn

### 1. Clonar e instalar dependências

```bash
cd backend-primaCard
npm install
```

### 2. Configurar variáveis de ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

Edite o `.env` com suas configurações:

```env
NODE_ENV=development
PORT=3000

# PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/primacard?schema=public"

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production

# Email (configure seu SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Admin API Key (para jobs internos)
ADMIN_API_KEY=your-admin-api-key-change-in-production
```

### 3. Setup do banco de dados

```bash
# Gerar cliente Prisma
npm run prisma:generate

# Executar migrations
npm run prisma:migrate

# (Opcional) Popular banco com dados iniciais
npm run prisma:seed
```

### 4. Executar o servidor

```bash
# Desenvolvimento (com hot reload)
npm run dev

# Produção
npm run build
npm start
```

O servidor estará rodando em `http://localhost:3000`

## 📚 Documentação da API

Após iniciar o servidor, acesse:

- **Swagger UI**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/health

## 🔑 Principais Endpoints

### Autenticação (`/api/v1/auth`)

- `POST /register` - Registrar novo usuário
- `POST /login` - Login
- `POST /refresh` - Renovar token
- `POST /logout` - Logout
- `POST /forgot-password` - Solicitar reset de senha
- `POST /reset-password` - Resetar senha com OTP
- `POST /verify-otp` - Verificar email

### Consultas (`/api/v1/appointments`)

- `POST /appointments` - Criar consulta
- `GET /appointments` - Listar consultas
- `GET /appointments/:id` - Detalhes da consulta
- `PATCH /appointments/:id/accept` - Aceitar consulta (profissional)
- `PATCH /appointments/:id/cancel` - Cancelar consulta
- `PATCH /appointments/:id/mark-arrival` - Marcar chegada do paciente
- `PATCH /appointments/:id/complete` - Completar consulta
- `PATCH /appointments/:id/mark-no-show` - Marcar falta

### Pontos (`/api/v1/points`)

- `GET /points/me` - Ver saldo de pontos
- `GET /points/me/transactions` - Histórico de transações
- `POST /points/adjust` - Ajustar pontos (admin)

### Recompensas (`/api/v1/rewards`)

- `POST /rewards` - Criar recompensa
- `GET /rewards` - Listar recompensas
- `POST /rewards/:id/redeem` - Resgatar recompensa

### Resgates (`/api/v1/redemptions`)

- `GET /redemptions` - Listar resgates
- `PATCH /redemptions/:id/confirm` - Confirmar resgate (profissional)
- `PATCH /redemptions/:id/cancel` - Cancelar resgate
- `POST /redemptions/:id/generate-otp` - Gerar OTP

## 🔐 Autenticação

A API usa JWT Bearer tokens. Após login, inclua o token no header:

```
Authorization: Bearer <access_token>
```

## 👥 Roles (Papéis)

- **PATIENT** - Paciente
- **PROFESSIONAL** - Profissional da saúde
- **ADMIN** - Administrador

## 📊 Sistema de Pontos

### Buckets de Pontos

- **general** - Pontos gerais (podem ser usados em qualquer recompensa)
- **[categoria]** - Pontos específicos por categoria de procedimento (ex: "clareamento", "limpeza")

### Como Ganhar Pontos

1. **Realizar procedimento** - Pontos gerais + específicos da categoria
2. **Pontualidade** - Bônus por chegar no horário
3. **Indicações** - Pontos quando indicado completa primeira consulta

### Penalidades

- **Cancelamento tardio** (< 24h) - Perde pontos
- **No-show** - Perde pontos (dobro da penalidade de cancelamento)

## 🔄 Fluxos Principais

### Fluxo de Agendamento

1. Paciente solicita consulta → status `REQUESTED`
2. Profissional aceita → status `SCHEDULED`
3. Paciente chega → profissional marca chegada
4. Consulta concluída → status `COMPLETED`
5. Ambos avaliam dentro de 7 dias
6. Pontos concedidos após avaliação ou automaticamente após 7 dias

### Fluxo de Resgate

1. Paciente escolhe recompensa
2. Sistema verifica pontos e cria `HOLD`
3. Pontos são debitados imediatamente
4. Paciente gera OTP e mostra ao profissional
5. Profissional confirma → status `REDEEMED`
6. Se não confirmado em 7 dias → `EXPIRED` e pontos devolvidos

## ⏰ Jobs Agendados

### `closeEvaluationWindows` (Diário 3h)
- Fecha janelas de avaliação de 7 dias
- Concede pontos automaticamente se profissional não avaliou

### `expireRedemptionHolds` (A cada hora)
- Expira resgates em HOLD que passaram do prazo
- Devolve pontos ao paciente

### `autoCompleteAppointments` (A cada 30 min)
- Auto-completa consultas que já passaram

### `cleanupOldOTPs` (Diário 4h)
- Remove códigos OTP antigos

### `cleanupExpiredTokens` (Diário 5h)
- Remove refresh tokens expirados

## 🔍 Validações Importantes

### Double Booking
- Sistema valida conflitos de horário para profissional e paciente
- Usa lock otimista por intervalo de tempo

### Pontualidade
- Tolerância de 10 minutos (configurável)
- Estados: EXACT, WITHIN_TOLERANCE, LATE, NO_SHOW

### Cancelamento
- Até 24h antes: sem penalidade
- Menos de 24h: penalidade de pontos
- Diferencia cancelamento de no-show

### Resgate de Recompensas
- Valida saldo em buckets permitidos
- Respeita buckets excluídos
- Ordem: buckets específicos primeiro, depois geral

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Testes em modo watch
npm run test:watch

# Coverage
npm test -- --coverage
```

## 🗄️ Migrations

```bash
# Criar nova migration
npx prisma migrate dev --name nome_da_migration

# Aplicar migrations
npx prisma migrate deploy

# Ver status
npx prisma migrate status
```

## 🔧 Scripts Úteis

```bash
npm run dev          # Desenvolvimento com hot reload
npm run build        # Build para produção
npm start            # Executar produção
npm run lint         # Linter
npm run format       # Formatar código
npm run prisma:studio # Interface gráfica do banco
```

## 🐛 Debug e Logs

Logs são salvos em:
- `logs/error.log` - Apenas erros
- `logs/combined.log` - Todos os logs

Nível de log configurável via `LOG_LEVEL` no `.env`:
- `error`
- `warn`
- `info`
- `debug`

## 🔒 Segurança

- Senhas hasheadas com bcrypt (12 rounds)
- JWT com expiração configurável
- Rate limiting configurável
- Helmet.js para headers de segurança
- CORS configurável
- OTP para ações sensíveis (reset senha, confirmação resgate)
- Idempotência em operações críticas

## 📝 Auditoria

Todas as ações importantes são registradas na tabela `audit_logs`:
- Quem fez a ação (`actorId`)
- Tipo de ação (`action`)
- Entidade afetada (`entityType`, `entityId`)
- Dados antes e depois
- IP e User Agent

## 🌍 Deploy e Produção

### Deploy Rápido na Vercel 🚀

**Recomendado para começar rapidamente!**

1. Siga o guia completo: **[VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md)**
2. Configure database (Neon, Supabase)
3. Adicione environment variables
4. Deploy com um clique!

```bash
# Via CLI
npm i -g vercel
vercel --prod
```

### Outras Opções de Deploy

Guias completos em **[DEPLOYMENT.md](./DEPLOYMENT.md)**:

- ✅ **Vercel** - Serverless, deploy em 5min (recomendado para MVP)
- ✅ **Heroku** - PaaS clássico
- ✅ **DigitalOcean** - App Platform
- ✅ **AWS** - Elastic Beanstalk
- ✅ **Render** - Alternativa ao Heroku
- ✅ **Railway** - Deploy simples
- ✅ **VPS** - PM2 + Nginx (controle total)
- ✅ **Docker** - Container pronto
- ✅ **Kubernetes** - Produção enterprise

### Checklist Pré-Deploy

- [ ] Alterar `JWT_SECRET` e `JWT_REFRESH_SECRET` (gerar novos!)
- [ ] Configurar SMTP real (Gmail, SendGrid, etc.)
- [ ] Alterar `ADMIN_API_KEY` (seguro)
- [ ] Configurar `FRONTEND_URL` para CORS
- [ ] Database PostgreSQL configurado (não MySQL em prod)
- [ ] Configurar `NODE_ENV=production`
- [ ] Executar `prisma migrate deploy`
- [ ] Testar health check e Swagger docs
- [ ] Setup de backup do banco
- [ ] Monitoramento de logs (Sentry, New Relic)
- [ ] SSL/TLS configurado
- [ ] Rate limiting apropriado

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

MIT

## 📞 Suporte

Para dúvidas ou problemas, abra uma issue no repositório.

---

**Desenvolvido com ❤️ para o ecossistema de saúde**
