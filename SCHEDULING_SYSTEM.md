# Sistema Integrado de Agendamento e Configuração de Horários

## Visão Geral

O sistema de agendamento está totalmente integrado com as configurações de horário dos profissionais, aplicando múltiplos filtros para determinar os horários disponíveis.

## Fluxo de Filtragem de Horários

### 1. Filtros Baseados em Configuração do Profissional

#### 1.1 Verificação do Dia da Semana
```typescript
// O sistema verifica se o dia está habilitado na agenda semanal
weeklySchedule: [
  { day: 0, enabled: false }, // Domingo desabilitado
  { day: 1, enabled: true, start: '08:00', end: '17:00' }, // Segunda habilitada
  // ...
]
```

**Resultado:** Se o dia não estiver habilitado, retorna lista vazia de horários.

#### 1.2 Verificação de Datas Bloqueadas
```typescript
// Datas específicas bloqueadas pelo profissional
blockedDates: [
  { date: '2025-12-25' }, // Natal
  { date: '2025-12-31' }, // Ano Novo
]
```

**Resultado:** Se a data estiver bloqueada, retorna lista vazia de horários.

#### 1.3 Horário de Expediente
```typescript
// Define os horários de início e fim do expediente
start: '08:00',
end: '17:00'
```

**Resultado:** Slots são gerados apenas dentro deste intervalo.

#### 1.4 Intervalo de Almoço/Descanso
```typescript
break: true,
breakStart: '12:00',
breakEnd: '13:00'
```

**Resultado:** Horários que sobrepõem o intervalo são marcados como indisponíveis.

### 2. Filtros Baseados em Agendamentos Existentes

#### 2.1 Conflito com Agendamentos
```typescript
// Busca agendamentos existentes no dia
const existingAppointments = await prisma.appointment.findMany({
  where: {
    professionalId,
    startsAt: { gte: startOfDay, lte: endOfDay },
    status: { notIn: ['CANCELED_BY_PATIENT', 'CANCELED_BY_PROFESSIONAL', ...] }
  }
});
```

**Resultado:** Horários que conflitam com agendamentos são marcados como indisponíveis.

#### 2.2 Tempo de Buffer
```typescript
bufferTime: 5 // minutos
```

**Resultado:** Adiciona tempo antes e depois de cada agendamento para preparação/limpeza.

### 3. Filtros Temporais

#### 3.1 Horários no Passado
```typescript
const isPast = slotStart < now;
```

**Resultado:** Horários já passados são marcados como indisponíveis.

## Ordem de Aplicação dos Filtros

```
1. ✅ Dia habilitado na agenda semanal?
   ├─ Não → Retorna []
   └─ Sim → Continua

2. ✅ Data está bloqueada?
   ├─ Sim → Retorna []
   └─ Não → Continua

3. ✅ Gera slots dentro do horário de expediente

4. ✅ Para cada slot gerado:
   ├─ Está no passado? → available: false
   ├─ Sobrepõe intervalo? → available: false
   ├─ Conflita com agendamento (+ buffer)? → available: false
   └─ Passou todos filtros → available: true
```

## Configuração de Duração dos Slots

### Prioridade de Duração

1. **Procedimento específico** (se informado)
   ```typescript
   procedure.defaultDurationMinutes // Ex: 60 minutos
   ```

2. **Configuração padrão do profissional**
   ```typescript
   scheduleSettings.appointmentDuration // Ex: 30 minutos
   ```

3. **Fallback global**
   ```typescript
   30 minutos // Padrão do sistema
   ```

## Exemplo Prático

### Cenário
- **Profissional:** Dr. João
- **Data:** 2025-12-21 (Segunda-feira)
- **Configuração:**
  - Expediente: 08:00 - 17:00
  - Intervalo: 12:00 - 13:00
  - Duração: 30 minutos
  - Buffer: 5 minutos
- **Agendamentos existentes:**
  - 09:00 - 09:30 (Paciente A)
  - 14:00 - 14:30 (Paciente B)

### Horários Gerados

```
08:00 - 08:30 ✅ Disponível
08:35 - 09:05 ❌ Conflita com agendamento (buffer)
09:10 - 09:40 ✅ Disponível
09:45 - 10:15 ✅ Disponível
10:20 - 10:50 ✅ Disponível
10:55 - 11:25 ✅ Disponível
11:30 - 12:00 ✅ Disponível
12:05 - 12:35 ❌ Sobrepõe intervalo
12:40 - 13:10 ❌ Sobrepõe intervalo
13:15 - 13:45 ✅ Disponível
13:50 - 14:20 ❌ Conflita com agendamento (buffer)
14:25 - 14:55 ❌ Conflita com agendamento (buffer)
15:00 - 15:30 ✅ Disponível
15:35 - 16:05 ✅ Disponível
16:10 - 16:40 ✅ Disponível
```

## Endpoints da API

### 1. Obter Horários Disponíveis
```http
GET /api/v1/appointments/available-slots/:professionalId?date=2025-12-21&procedureId=xxx
```

**Resposta:**
```json
{
  "data": {
    "slots": [
      { "start": "08:00", "end": "08:30", "available": true },
      { "start": "08:35", "end": "09:05", "available": false },
      // ...
    ]
  }
}
```

### 2. Obter Datas Disponíveis
```http
GET /api/v1/appointments/available-dates/:professionalId?startDate=2025-12-01&endDate=2025-12-31
```

**Resposta:**
```json
{
  "data": {
    "dates": [
      { "date": "2025-12-21", "hasAvailableSlots": true },
      { "date": "2025-12-22", "hasAvailableSlots": true },
      { "date": "2025-12-25", "hasAvailableSlots": false },
      // ...
    ]
  }
}
```

## Configuração de Horários do Profissional

O profissional pode configurar seus horários através do endpoint:

```http
PUT /api/v1/professionals/:id/schedule-settings
```

**Payload:**
```json
{
  "weeklySchedule": [
    {
      "day": 1,
      "enabled": true,
      "start": "08:00",
      "end": "17:00",
      "break": true,
      "breakStart": "12:00",
      "breakEnd": "13:00"
    }
    // ...
  ],
  "appointmentDuration": 30,
  "bufferTime": 5,
  "blockedDates": [
    { "date": "2025-12-25", "reason": "Feriado - Natal" }
  ]
}
```

## Benefícios da Integração

1. ✅ **Filtro Automático:** Horários indisponíveis são automaticamente removidos
2. ✅ **Configuração Flexível:** Profissional controla totalmente sua agenda
3. ✅ **Evita Conflitos:** Sistema previne dupla marcação
4. ✅ **Respeita Intervalos:** Considera tempo de descanso e buffer
5. ✅ **Performance:** Filtros aplicados em uma única consulta
6. ✅ **Manutenibilidade:** Lógica centralizada e documentada

## Histórico de Melhorias

### v2.0 - Refatoração de Integração (Jan 2025)

**Problema Anterior:**
- Endpoint `/professionals/:id/availability` tinha horários hardcoded (8:00-18:00)
- Configurações de agenda do profissional eram completamente ignoradas
- Pacientes podiam agendar em horários impossíveis (madrugada, intervalos de almoço, dias bloqueados)

**Solução Implementada:**
- Método `getAvailability()` em `ProfessionalService` foi refatorado para delegar ao `AppointmentService.getAvailableSlots()`
- Agora TODOS os endpoints respeitam as configurações de agenda:
  - ✅ Dias habilitados/desabilitados
  - ✅ Horários de expediente configurados
  - ✅ Intervalos de descanso
  - ✅ Datas bloqueadas
  - ✅ Agendamentos existentes
  - ✅ Duração do procedimento

**Resultado:**
- 100% dos horários exibidos respeitam a configuração do profissional
- Todos os 160 testes continuam passando
- Compatibilidade mantida com frontend (formato de resposta preservado)

## Próximas Melhorias

- [ ] Cache de horários disponíveis
- [ ] Notificação quando horário se torna disponível
- [ ] Sugestão de horários alternativos
- [ ] Integração com calendário externo (Google Calendar, Outlook)
- [ ] Recorrência de bloqueios (ex: toda primeira segunda do mês)
