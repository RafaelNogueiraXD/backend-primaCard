# Atualização do Sistema de Indicação (Anti-Fraude)

## 📋 Resumo das Mudanças

Foi implementada uma atualização crítica no sistema de pontuação por indicação para prevenir fraudes e abusos.

### ❌ Sistema Anterior (Vulnerável)

```
Usuário se cadastra com código → Indicador recebe pontos IMEDIATAMENTE
```

**Problema:** Um usuário malicioso poderia criar várias contas falsas usando seu próprio código de indicação e acumular pontos sem nenhuma utilização real do sistema.

### ✅ Novo Sistema (Anti-Fraude)

```
Usuário se cadastra com código → Marca e CONCLUI uma consulta → Indicador recebe pontos
```

**Solução:** O indicador só recebe pontos quando o usuário indicado demonstra valor real ao sistema completando sua primeira consulta.

## 🔄 Fluxo Detalhado

### Exemplo 1: Caso de Sucesso
1. **João** possui código de indicação `29kd41`
2. **Miguel** se cadastra usando o código `29kd41`
   - Sistema cria registro de `Referral` com status `PENDING`
   - João **NÃO** recebe pontos ainda
3. **Miguel** agenda uma consulta com um profissional
4. **Miguel** comparece à consulta e o profissional marca como concluída
5. ✅ **João recebe seus pontos de indicação**

### Exemplo 2: Cadastro sem Uso
1. **Ana** possui código de indicação `X7F92A`
2. **Carlos** se cadastra usando o código `X7F92A`
   - Sistema cria registro de `Referral` com status `PENDING`
   - Ana **NÃO** recebe pontos
3. **Carlos** nunca agenda nenhuma consulta
4. ❌ **Ana nunca recebe pontos** (correto, pois Carlos não agregou valor)

### Exemplo 3: Consulta Não Concluída
1. **Lucas** possui código de indicação `AB91ZX`
2. **Fernanda** se cadastra usando o código `AB91ZX`
   - Sistema cria registro de `Referral` com status `PENDING`
3. **Fernanda** agenda uma consulta mas não comparece
4. Profissional marca a consulta como cancelada/não concluída
5. ❌ **Lucas não recebe pontos** (correto, pois não houve conclusão efetiva)

## 🔧 Alterações Técnicas

### 1. Arquivo: `auth.service.ts`
**Localização:** `/backend-primaCard/src/modules/auth/auth.service.ts`

**Mudança:** Removida a criação imediata de `pointTransaction` durante o registro.

```typescript
// ANTES (REMOVIDO):
await tx.pointTransaction.create({
  data: {
    userId: referrer.id,
    bucket: 'general',
    delta: config.referral.pointsGeneral,
    cause: 'REFERRAL_COMPLETED',
    // ...
  },
});

// AGORA:
// NOTE: Points are NOT awarded immediately upon registration
// Points will be awarded when the referred user completes their first appointment
// This prevents abuse/spam of the referral system
```

### 2. Arquivo: `referral.service.ts`
**Localização:** `/backend-primaCard/src/modules/referrals/referral.service.ts`

**Melhorias:**
- Adicionada documentação detalhada ao método `checkAndCompleteReferral`
- Adicionada documentação ao método `complete`
- Comentários explicativos sobre o sistema anti-fraude

### 3. Arquivo: `points.service.ts`
**Localização:** `/backend-primaCard/src/modules/points/points.service.ts`

**Melhorias:**
- Adicionada documentação ao método `grantReferralPoints`
- Explicação clara de quando os pontos são concedidos

### 4. Integração com Conclusão de Consulta
**Localização:** `/backend-primaCard/src/modules/appointments/appointment.service.ts`

O método `complete()` já estava corretamente chamando `referralService.checkAndCompleteReferral()`, que:
1. Verifica se o usuário tem indicações pendentes
2. Verifica se esta é a primeira consulta concluída
3. Se sim, completa a indicação e concede os pontos

## 📊 Impacto no Banco de Dados

### Tabela `referrals`
- Campo `status` permanece como `PENDING` até a primeira consulta concluída
- Campos `completedAt` e `awardedAt` só são preenchidos após primeira consulta

### Tabela `point_transactions`
- Transações com `cause: 'REFERRAL_COMPLETED'` só são criadas após consulta concluída
- Não há mais transações imediatas no momento do cadastro

## 🧪 Como Testar

### Teste Manual

1. **Criar um usuário indicador:**
   ```bash
   POST /api/auth/register
   {
     "email": "indicador@test.com",
     "password": "senha123",
     "firstName": "João",
     "lastName": "Silva",
     "phone": "+5511999999999",
     "role": "PATIENT"
   }
   ```

2. **Obter código de indicação:**
   ```bash
   GET /api/users/referral-code
   # Retorna: { "referralCode": "XXXXX" }
   ```

3. **Criar usuário indicado:**
   ```bash
   POST /api/auth/register
   {
     "email": "indicado@test.com",
     "password": "senha123",
     "firstName": "Miguel",
     "lastName": "Santos",
     "phone": "+5511888888888",
     "role": "PATIENT",
     "referralCode": "XXXXX"  # Código do indicador
   }
   ```

4. **Verificar pontos do indicador:**
   ```bash
   GET /api/points/balance
   # Deve retornar 0 pontos inicialmente
   ```

5. **Criar e concluir consulta do indicado:**
   ```bash
   POST /api/appointments
   # Criar consulta...
   
   PUT /api/appointments/{id}/complete
   # Profissional marca como concluída
   ```

6. **Verificar pontos do indicador novamente:**
   ```bash
   GET /api/points/balance
   # Agora deve mostrar os pontos de indicação (ex: 20 pontos)
   ```

## 🔐 Benefícios de Segurança

1. **Prevenção de Fraude:** Usuários não podem mais criar contas falsas para acumular pontos
2. **Validação de Valor Real:** Pontos só são concedidos quando há uso efetivo do sistema
3. **Integridade do Sistema:** Mantém a economia de pontos equilibrada e justa
4. **Incentivo Correto:** Incentiva usuários a indicarem pessoas que realmente vão usar o app

## 📝 Notas Importantes

- ⚠️ **Migração de Dados:** Indicações antigas criadas antes desta atualização seguem as regras antigas
- ⚠️ **Regra de Versionamento:** O campo `ruleVersion` no modelo `Referral` permite rastrear qual versão das regras foi aplicada
- ⚠️ **Primeira Consulta:** Apenas a PRIMEIRA consulta concluída libera os pontos, consultas subsequentes não geram novos pontos de indicação

## 🎯 Configurações

O valor de pontos por indicação é configurável:

```env
REFERRAL_POINTS_GENERAL=20  # Padrão: 20 pontos
```

## 📚 Referências

- [auth.service.ts](src/modules/auth/auth.service.ts) - Lógica de registro
- [referral.service.ts](src/modules/referrals/referral.service.ts) - Lógica de indicações
- [appointment.service.ts](src/modules/appointments/appointment.service.ts) - Lógica de conclusão de consulta
- [points.service.ts](src/modules/points/points.service.ts) - Lógica de pontuação

---

**Data da Atualização:** 29 de Janeiro de 2026  
**Versão:** 1.0  
**Status:** ✅ Implementado
