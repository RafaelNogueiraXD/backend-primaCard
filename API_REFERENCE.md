# API Reference - PrimaCard Backend

Guia completo com exemplos de uso da API.

## 📌 Base URL

```
Development: http://localhost:3000/api/v1
Production: https://api.primacard.com/api/v1
```

## 🔐 Autenticação

A maioria dos endpoints requer autenticação via JWT Bearer token.

### Header de Autenticação

```http
Authorization: Bearer <access_token>
```

---

## 🔑 Auth Endpoints

### POST /auth/register

Registrar novo usuário (paciente ou profissional).

**Request Body:**

```json
{
  "email": "joao@email.com",
  "password": "SenhaSegura123!",
  "firstName": "João",
  "lastName": "Silva",
  "role": "PATIENT",
  "phone": "+5511999999999"
}
```

Para profissional, adicionar:

```json
{
  "role": "PROFESSIONAL",
  "registrationNumber": "CRO-SP-12345",
  "specialty": "Odontologia"
}
```

**Response (201):**

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "joao@email.com",
      "firstName": "João",
      "lastName": "Silva",
      "role": "PATIENT"
    },
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc..."
    }
  }
}
```

### POST /auth/login

Fazer login.

**Request:**

```json
{
  "email": "joao@email.com",
  "password": "SenhaSegura123!"
}
```

**Response (200):**

```json
{
  "data": {
    "user": { ... },
    "tokens": {
      "accessToken": "...",
      "refreshToken": "..."
    }
  }
}
```

### POST /auth/refresh

Renovar access token usando refresh token.

**Request:**

```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response (200):**

```json
{
  "data": {
    "accessToken": "new_access_token",
    "refreshToken": "new_refresh_token"
  }
}
```

### POST /auth/logout

Fazer logout (requer autenticação).

**Request:**

```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response (204):** No content

### POST /auth/forgot-password

Solicitar reset de senha.

**Request:**

```json
{
  "email": "joao@email.com"
}
```

**Response (200):**

```json
{
  "data": {
    "message": "If the email exists, a reset code will be sent"
  }
}
```

### POST /auth/reset-password

Resetar senha com OTP.

**Request:**

```json
{
  "email": "joao@email.com",
  "otp": "123456",
  "newPassword": "NovaSenha123!"
}
```

**Response (200):**

```json
{
  "data": {
    "message": "Password reset successful"
  }
}
```

---

## 👤 User Endpoints

### GET /users/me

Obter dados do usuário autenticado.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "data": {
    "id": "uuid",
    "email": "joao@email.com",
    "firstName": "João",
    "lastName": "Silva",
    "role": "PATIENT",
    "emailVerified": true,
    "createdAt": "2025-01-17T10:00:00Z"
  }
}
```

### PATCH /users/me

Atualizar dados do usuário.

**Request:**

```json
{
  "firstName": "João Pedro",
  "phone": "+5511988888888"
}
```

**Response (200):**

```json
{
  "data": {
    "id": "uuid",
    "email": "joao@email.com",
    "firstName": "João Pedro",
    "phone": "+5511988888888"
  }
}
```

---

## 📅 Appointment Endpoints

### POST /appointments

Criar nova consulta.

**Paciente solicita:**

```json
{
  "professionalId": "prof-uuid",
  "procedureId": "proc-uuid",
  "startsAt": "2025-01-20T14:00:00Z"
}
```

**Profissional cria diretamente:**

```json
{
  "patientId": "patient-uuid",
  "procedureId": "proc-uuid",
  "startsAt": "2025-01-20T14:00:00Z"
}
```

**Response (201):**

```json
{
  "data": {
    "id": "apt-uuid",
    "status": "REQUESTED",
    "startsAt": "2025-01-20T14:00:00Z",
    "endsAt": "2025-01-20T14:30:00Z",
    "professional": { ... },
    "patient": { ... },
    "procedure": { ... },
    "procedureSnapshot": {
      "name": "Limpeza Dental",
      "pointsGeneral": 10,
      "pointsCategory": 15
    }
  }
}
```

### GET /appointments

Listar consultas do usuário.

**Query Parameters:**

- `status`: REQUESTED, SCHEDULED, COMPLETED, etc.
- `from`: Data inicial (ISO 8601)
- `to`: Data final (ISO 8601)
- `page`: Página (padrão: 1)
- `perPage`: Itens por página (padrão: 20)

**Example:**

```
GET /appointments?status=SCHEDULED&from=2025-01-01&page=1
```

**Response (200):**

```json
{
  "data": [
    {
      "id": "apt-uuid",
      "status": "SCHEDULED",
      "startsAt": "2025-01-20T14:00:00Z",
      "professional": { ... },
      "patient": { ... }
    }
  ],
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### GET /appointments/:id

Obter detalhes de uma consulta.

**Response (200):**

```json
{
  "data": {
    "id": "apt-uuid",
    "status": "COMPLETED",
    "startsAt": "2025-01-20T14:00:00Z",
    "endsAt": "2025-01-20T14:30:00Z",
    "arrivalMarkedAt": "2025-01-20T14:05:00Z",
    "punctualityFlag": "WITHIN_TOLERANCE",
    "completedAt": "2025-01-20T14:32:00Z",
    "professional": { ... },
    "patient": { ... },
    "procedureSnapshot": { ... },
    "reviews": [...]
  }
}
```

### PATCH /appointments/:id/accept

Profissional aceita consulta solicitada.

**Response (200):**

```json
{
  "data": {
    "id": "apt-uuid",
    "status": "SCHEDULED"
  }
}
```

### PATCH /appointments/:id/cancel

Cancelar consulta.

**Request:**

```json
{
  "reason": "Imprevisto pessoal"
}
```

**Response (200):**

```json
{
  "data": {
    "id": "apt-uuid",
    "status": "CANCELED_BY_PATIENT",
    "canceledAt": "2025-01-19T10:00:00Z",
    "canceledReason": "Imprevisto pessoal"
  }
}
```

### PATCH /appointments/:id/mark-arrival

Profissional marca chegada do paciente.

**Request:**

```json
{
  "arrivalMarkedAt": "2025-01-20T14:07:00Z"
}
```

**Response (200):**

```json
{
  "data": {
    "id": "apt-uuid",
    "arrivalMarkedAt": "2025-01-20T14:07:00Z",
    "punctualityFlag": "WITHIN_TOLERANCE"
  }
}
```

### PATCH /appointments/:id/complete

Profissional marca consulta como completa.

**Response (200):**

```json
{
  "data": {
    "id": "apt-uuid",
    "status": "COMPLETED",
    "completedAt": "2025-01-20T14:32:00Z"
  }
}
```

### PATCH /appointments/:id/mark-no-show

Profissional marca falta do paciente.

**Response (200):**

```json
{
  "data": {
    "id": "apt-uuid",
    "status": "NO_SHOW_PATIENT",
    "punctualityFlag": "NO_SHOW"
  }
}
```

---

## 💎 Points Endpoints

### GET /points/me

Ver saldo de pontos.

**Response (200):**

```json
{
  "data": {
    "general": 125,
    "limpeza": 45,
    "clareamento": 30,
    "restauracao": 20
  }
}
```

### GET /points/me/transactions

Histórico de transações de pontos.

**Query Parameters:**

- `bucket`: general, limpeza, etc.
- `cause`: PROCEDURE_COMPLETED, PUNCTUAL, etc.
- `page`, `perPage`

**Response (200):**

```json
{
  "data": [
    {
      "id": "tx-uuid",
      "bucket": "general",
      "delta": 10,
      "cause": "PROCEDURE_COMPLETED",
      "referenceType": "appointment",
      "referenceId": "apt-uuid",
      "createdAt": "2025-01-20T14:35:00Z"
    },
    {
      "id": "tx-uuid-2",
      "bucket": "limpeza",
      "delta": 15,
      "cause": "PROCEDURE_COMPLETED",
      "referenceType": "appointment",
      "referenceId": "apt-uuid",
      "createdAt": "2025-01-20T14:35:00Z"
    }
  ],
  "meta": { ... }
}
```

### POST /points/adjust

Admin ajusta pontos manualmente.

**Headers:** `X-Admin-Api-Key: <admin_key>`

**Request:**

```json
{
  "userId": "user-uuid",
  "bucket": "general",
  "delta": 50,
  "reason": "Compensação por erro no sistema"
}
```

**Response (201):**

```json
{
  "data": {
    "id": "tx-uuid",
    "userId": "user-uuid",
    "bucket": "general",
    "delta": 50,
    "cause": "ADMIN_ADJUSTMENT"
  }
}
```

---

## 🎁 Rewards Endpoints

### GET /rewards

Listar recompensas disponíveis.

**Query Parameters:**

- `active`: true/false
- `professionalId`: Filtrar por profissional

**Response (200):**

```json
{
  "data": [
    {
      "id": "reward-uuid",
      "name": "Desconto 10% em Clareamento",
      "description": "...",
      "costPoints": 50,
      "allowedBuckets": ["general", "limpeza"],
      "excludedBuckets": ["clareamento"],
      "isActive": true,
      "professional": { ... }
    }
  ],
  "meta": { ... }
}
```

### POST /rewards/:id/redeem

Resgatar recompensa.

**Headers:** `Idempotency-Key: <uuid>` (opcional, recomendado)

**Response (201):**

```json
{
  "data": {
    "id": "redemption-uuid",
    "rewardId": "reward-uuid",
    "status": "HOLD",
    "holdBreakdown": {
      "limpeza": 30,
      "general": 20
    },
    "expiresAt": "2025-01-27T14:00:00Z",
    "requestedAt": "2025-01-20T14:00:00Z"
  }
}
```

---

## 🎟️ Redemption Endpoints

### GET /redemptions

Listar resgates do usuário.

**Query Parameters:**

- `status`: HOLD, REDEEMED, EXPIRED, CANCELED

**Response (200):**

```json
{
  "data": [
    {
      "id": "redemption-uuid",
      "status": "HOLD",
      "reward": {
        "name": "Desconto 10%"
      },
      "holdBreakdown": { ... },
      "expiresAt": "2025-01-27T14:00:00Z"
    }
  ],
  "meta": { ... }
}
```

### POST /redemptions/:id/generate-otp

Gerar OTP para validação.

**Response (200):**

```json
{
  "data": {
    "otp": "123456",
    "expiresAt": "2025-01-20T14:10:00Z"
  }
}
```

### PATCH /redemptions/:id/confirm

Profissional confirma resgate com OTP.

**Request:**

```json
{
  "otpCode": "123456"
}
```

**Response (200):**

```json
{
  "data": {
    "id": "redemption-uuid",
    "status": "REDEEMED",
    "redeemedAt": "2025-01-20T14:05:00Z"
  }
}
```

### PATCH /redemptions/:id/cancel

Paciente cancela resgate em HOLD.

**Response (200):**

```json
{
  "data": {
    "id": "redemption-uuid",
    "status": "CANCELED",
    "canceledAt": "2025-01-21T10:00:00Z"
  }
}
```

---

## ⭐ Review Endpoints

### POST /appointments/:id/reviews

Criar avaliação após consulta.

**Request:**

```json
{
  "rating": 5,
  "comment": "Excelente atendimento!",
  "tags": ["pontualidade", "atendimento", "qualidade"]
}
```

**Response (201):**

```json
{
  "data": {
    "id": "review-uuid",
    "appointmentId": "apt-uuid",
    "authorId": "user-uuid",
    "targetId": "professional-uuid",
    "rating": 5,
    "comment": "Excelente atendimento!",
    "createdAt": "2025-01-21T10:00:00Z"
  }
}
```

---

## 🔗 Referral Endpoints

### POST /referrals

Indicar amigo.

**Request:**

```json
{
  "referredEmail": "amigo@email.com",
  "referredPhone": "+5511977777777"
}
```

**Response (201):**

```json
{
  "data": {
    "id": "referral-uuid",
    "referrerId": "user-uuid",
    "referredEmail": "amigo@email.com",
    "status": "PENDING",
    "createdAt": "2025-01-20T10:00:00Z"
  }
}
```

### GET /referrals

Listar indicações.

**Response (200):**

```json
{
  "data": [
    {
      "id": "referral-uuid",
      "referredEmail": "amigo@email.com",
      "status": "COMPLETED",
      "completedAt": "2025-01-22T15:00:00Z",
      "awardedAt": "2025-01-22T15:01:00Z"
    }
  ],
  "meta": { ... }
}
```

---

## 🔔 Notification Endpoints

### GET /notifications

Listar notificações.

**Query Parameters:**

- `unread`: true/false

**Response (200):**

```json
{
  "data": [
    {
      "id": "notif-uuid",
      "type": "APPOINTMENT_ACCEPTED",
      "title": "Consulta Confirmada",
      "message": "Sua consulta foi confirmada para 20/01 às 14h",
      "isRead": false,
      "createdAt": "2025-01-19T16:00:00Z"
    }
  ],
  "meta": { ... }
}
```

### PATCH /notifications/:id/read

Marcar notificação como lida.

**Response (200):**

```json
{
  "data": {
    "id": "notif-uuid",
    "isRead": true,
    "readAt": "2025-01-20T10:00:00Z"
  }
}
```

---

## 🛠️ System Endpoints

### GET /system/enums

Obter todos os enums do sistema.

**Response (200):**

```json
{
  "data": {
    "appointmentStatus": [
      "REQUESTED",
      "SCHEDULED",
      "COMPLETED",
      ...
    ],
    "redemptionStatus": [...],
    "punctualityFlag": [...],
    "pointsCause": [...],
    "userRole": [...]
  }
}
```

### GET /health

Health check.

**Response (200):**

```json
{
  "status": "ok",
  "timestamp": "2025-01-20T10:00:00Z",
  "uptime": 12345.67
}
```

---

## ❌ Error Responses

Todas as respostas de erro seguem o formato:

```json
{
  "errors": [
    {
      "message": "Descrição do erro",
      "field": "campo_com_erro",
      "code": "ERROR_CODE"
    }
  ]
}
```

### Códigos Comuns

- `400 BAD_REQUEST`: Dados inválidos
- `401 UNAUTHORIZED`: Não autenticado
- `403 FORBIDDEN`: Sem permissão
- `404 NOT_FOUND`: Recurso não encontrado
- `409 CONFLICT`: Conflito (ex: horário ocupado)
- `422 UNPROCESSABLE_ENTITY`: Validação falhou
- `500 INTERNAL_ERROR`: Erro do servidor

---

## 📝 Exemplos Completos

### Fluxo Completo: Agendamento

1. **Paciente lista profissionais**
2. **Paciente solicita consulta**
3. **Profissional aceita**
4. **No dia, profissional marca chegada**
5. **Profissional completa consulta**
6. **Ambos avaliam**
7. **Pontos são concedidos**

### Fluxo Completo: Resgate

1. **Paciente vê recompensas disponíveis**
2. **Paciente resgata recompensa**
3. **Sistema cria HOLD e debita pontos**
4. **Paciente gera OTP**
5. **Paciente mostra OTP ao profissional**
6. **Profissional confirma com OTP**
7. **Status vira REDEEMED**

---

Para mais detalhes, acesse a documentação Swagger em `/api-docs`.
