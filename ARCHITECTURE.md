# Arquitetura do Backend PrimaCard

## 📐 Visão Geral

O backend do PrimaCard foi desenvolvido seguindo princípios de **Clean Architecture** e **Domain-Driven Design (DDD)**, organizado em camadas bem definidas para facilitar manutenção, escalabilidade e testes.

## 🏗️ Estrutura de Camadas

### 1. **Camada de Apresentação (Presentation Layer)**
- **Rotas (Routes)**: Definem os endpoints da API
- **Controllers**: Recebem requisições, validam entrada, chamam services
- **Middlewares**: Autenticação, validação, rate limiting, error handling

### 2. **Camada de Aplicação (Application Layer)**
- **Services**: Contêm a lógica de negócio
- **DTOs**: Objetos de transferência de dados
- **Validadores**: Regras de validação usando express-validator

### 3. **Camada de Domínio (Domain Layer)**
- **Entidades**: Modelos Prisma (definidos em `schema.prisma`)
- **Enums**: Constantes do sistema
- **Tipos**: Interfaces TypeScript

### 4. **Camada de Infraestrutura (Infrastructure Layer)**
- **Database**: Prisma Client e configurações
- **External Services**: Email, SMS, notificações
- **Jobs**: Tarefas agendadas com node-cron

## 🔄 Fluxo de Requisição

```
Request → Middleware → Route → Controller → Service → Prisma → Database
                                                          ↓
Response ← Middleware ← Route ← Controller ← Service ← Prisma
```

### Exemplo: Criar Consulta

1. **Cliente** → POST `/api/v1/appointments`
2. **Middleware Auth** → Valida JWT
3. **Middleware Validation** → Valida body da requisição
4. **Route** → Direciona para controller
5. **AppointmentController** → Processa entrada
6. **AppointmentService** → 
   - Valida procedimento
   - Verifica double booking
   - Cria snapshot do procedimento
   - Salva no banco via Prisma
7. **Response** → Retorna consulta criada

## 🎯 Princípios Seguidos

### SOLID

- **S - Single Responsibility**: Cada classe tem uma única responsabilidade
- **O - Open/Closed**: Aberto para extensão, fechado para modificação
- **L - Liskov Substitution**: Interfaces bem definidas
- **I - Interface Segregation**: Interfaces específicas por contexto
- **D - Dependency Inversion**: Dependência de abstrações, não de implementações

### Clean Code

- Nomes descritivos e auto-explicativos
- Funções pequenas e focadas
- Comentários apenas quando necessário
- Tratamento de erros consistente

### DRY (Don't Repeat Yourself)

- Utilitários compartilhados (`utils/`)
- Middlewares reutilizáveis
- Response handlers padronizados

## 🗄️ Modelagem de Dados

### Entidades Principais

#### User
- Base para pacientes e profissionais
- Contém credenciais e dados básicos
- Role-based (PATIENT, PROFESSIONAL, ADMIN)

#### Professional
- Extensão de User
- Dados específicos: CRO, especialidade, agenda
- Relacionado a: Procedures, Appointments, Rewards

#### Appointment
- Núcleo do sistema
- Estados: REQUESTED → SCHEDULED → COMPLETED
- Snapshot do procedimento (versionamento)
- Tracking de pontualidade e avaliações

#### Points System
- **Transactions**: Ledger de todas as movimentações
- **Buckets**: General + categorias específicas
- **Causes**: Origem de cada transação
- Idempotência para evitar duplicação

#### Reward/Redemption
- Rewards: Catálogo de recompensas
- Redemptions: Estados HOLD → REDEEMED
- OTP para confirmação presencial
- Auto-expiração com refund

### Relacionamentos Importantes

```
User (1) ─── (0..1) Professional
User (1) ─── (*) Appointment [as patient]
Professional (1) ─── (*) Appointment
Professional (1) ─── (*) Procedure
Procedure (1) ─── (*) Appointment
Appointment (1) ─── (*) Review
User (1) ─── (*) PointTransaction
User (1) ─── (*) Redemption
Professional (1) ─── (*) Reward
Reward (1) ─── (*) Redemption
User [referrer] (1) ─── (*) Referral
User [referred] (1) ─── (*) Referral
```

## 🔐 Segurança

### Autenticação e Autorização

1. **JWT Access Token** (curta duração: 15min)
   - Payload: userId, role, email
   - Usado em todas as requisições autenticadas

2. **JWT Refresh Token** (longa duração: 7 dias)
   - Armazenado no banco (refresh_tokens)
   - Usado para renovar access token

3. **Role-Based Access Control (RBAC)**
   - Middleware `authorize()` verifica permissões
   - Guards específicos por rota

### Proteções

- **Hashing**: bcrypt com 12 rounds para senhas
- **Rate Limiting**: Previne brute force
- **Helmet**: Headers de segurança
- **CORS**: Origem controlada
- **Input Validation**: express-validator
- **SQL Injection**: Proteção via Prisma ORM

### Auditoria

Todas as ações sensíveis são logadas:
```typescript
{
  actorId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  entityType: string,
  entityId: string,
  dataBefore: JSON,
  dataAfter: JSON,
  ipAddress: string,
  userAgent: string,
  createdAt: DateTime
}
```

## ⚡ Performance e Otimização

### Database

- **Índices**: Campos frequentemente consultados
  - `appointments`: (professionalId, startsAt), (patientId, startsAt)
  - `point_transactions`: (userId, bucket), (userId, createdAt)
  - `redemptions`: (userId, status), (status, expiresAt)

- **Paginação**: Limite de 20 itens por página (padrão)

- **Select Específico**: Buscar apenas campos necessários

### Caching (Futuro)

Sugestões para implementação futura:
- Redis para sessões
- Cache de procedimentos ativos
- Cache de saldos de pontos
- Invalidação por evento

### Jobs Otimizados

- Processamento em lote
- Limites de registros por execução
- Tratamento de erros individual (não para toda a batch)

## 🔄 Idempotência

Operações críticas suportam idempotência via `Idempotency-Key` header:

- Criação de consultas
- Resgates de recompensas
- Transações de pontos

```typescript
if (idempotencyKey) {
  const existing = await findByIdempotencyKey(idempotencyKey);
  if (existing) return existing;
}
// ... processa operação
```

## 📦 Modularização

### Estrutura de Módulo

```
module/
├── module.service.ts      # Lógica de negócio
├── module.controller.ts   # Handlers de requisições
├── module.routes.ts       # Definição de rotas
├── module.validation.ts   # Validações específicas
├── module.types.ts        # Tipos TypeScript
└── __tests__/
    └── module.test.ts     # Testes
```

### Benefícios

- **Coesão**: Código relacionado junto
- **Independência**: Módulos podem ser desenvolvidos separadamente
- **Testabilidade**: Fácil mockar dependências
- **Manutenibilidade**: Mudanças isoladas

## 🧩 Padrões de Design

### Service Layer Pattern
- Lógica de negócio separada dos controllers
- Reutilizável por múltiplos consumers

### Repository Pattern (via Prisma)
- Abstração do acesso a dados
- Facilita troca de ORM/DB no futuro

### Factory Pattern
- Criação de objetos complexos (snapshots, tokens)

### Strategy Pattern
- Cálculo de pontos por tipo de causa
- Políticas de cancelamento

## 🔮 Extensibilidade

### Adicionar Novo Módulo

1. Criar estrutura em `src/modules/novo-modulo/`
2. Definir service, controller, routes
3. Adicionar validações
4. Registrar rotas no `app.ts`
5. Documentar no Swagger
6. Escrever testes

### Adicionar Novo Tipo de Ponto

1. Adicionar categoria ao enum
2. Criar procedures com essa categoria
3. Sistema já calcula automaticamente buckets

### Adicionar Nova Notificação

1. Adicionar tipo ao enum `NotificationType`
2. Criar helper para disparar notificação
3. Integrar no fluxo necessário

## 🏃 Escalabilidade

### Horizontal

- Stateless: múltiplas instâncias sem problema
- Load balancer na frente
- Banco centralizado

### Vertical

- Otimização de queries
- Índices adequados
- Connection pooling

### Microservices (Futuro)

Candidatos a extração:
- Serviço de notificações
- Serviço de pontos/recompensas
- Serviço de agendamento

## 📊 Monitoramento

### Logs

- Winston para logging estruturado
- Níveis: error, warn, info, debug
- Rotação de logs recomendada

### Métricas Sugeridas

- Tempo de resposta por endpoint
- Taxa de erro
- Consultas criadas/canceladas
- Pontos concedidos/resgatados
- Jobs executados com sucesso/falha

### Alertas

- Falhas em jobs críticos
- Taxa de erro > 5%
- Tempo de resposta > 2s
- Uso de CPU/memória

## 🧪 Testabilidade

### Testes Unitários

- Services isolados
- Mocks do Prisma
- Funções utilitárias

### Testes de Integração

- Endpoints completos
- Banco de testes separado
- Seed de dados de teste

### Testes E2E

- Fluxos completos
- Ambiente staging
- Dados reais

## 📚 Documentação

### Auto-Documentação

- Swagger/OpenAPI via decorators
- Tipos TypeScript auto-explicativos
- Nomes descritivos

### Documentação Adicional

- README.md: Setup e overview
- ARCHITECTURE.md: Este arquivo
- Comentários JSDoc em funções complexas

## 🔄 CI/CD (Sugestão)

```yaml
Pipeline:
1. Lint & Format Check
2. Type Check (tsc --noEmit)
3. Unit Tests
4. Build
5. Integration Tests
6. Deploy to Staging
7. E2E Tests
8. Deploy to Production
```

## 🎓 Melhores Práticas

### Code Review Checklist

- [ ] Código segue padrões do projeto
- [ ] Validações de entrada implementadas
- [ ] Erros tratados adequadamente
- [ ] Logs apropriados adicionados
- [ ] Testes escritos
- [ ] Documentação atualizada
- [ ] Performance considerada
- [ ] Segurança avaliada

### Commits

- Mensagens descritivas
- Commits atômicos
- Referência a issues quando aplicável

---

**Última atualização**: 2025-01-17
