# 📧 Sistema de Notificações por Email - Documentação Completa

## ✅ Implementação Concluída

### 1. **EmailService** (`src/utils/email.service.ts`)

Serviço centralizado para envio de emails usando Nodemailer e Gmail SMTP.

**Características:**
- ✅ Configuração automática a partir do `.env`
- ✅ Templates HTML responsivos e profissionais
- ✅ Tratamento de erros robusto (não quebra fluxo principal)
- ✅ Logs detalhados de sucesso/falha
- ✅ Fallback para texto plano

**Métodos Disponíveis:**
1. `sendPasswordResetEmail()` - Recuperação de senha
2. `sendPointsReceivedEmail()` - Notificação de pontos
3. `sendNewAppointmentToProfessional()` - Nova consulta (profissional)
4. `sendAppointmentConfirmedToPatient()` - Consulta confirmada (paciente)
5. `sendAppointmentCompletedToPatient()` - Consulta finalizada (paciente)

---

### 2. **Recuperação de Senha** (AuthService)

**Endpoint:** `POST /api/v1/auth/forgot-password`

**Body:**
```json
{
  "email": "usuario@example.com"
}
```

**Fluxo:**
1. Valida se usuário existe
2. Gera senha numérica de 6 dígitos (ex: `123456`)
3. Atualiza hash no banco de dados
4. Envia email com a nova senha
5. Retorna mensagem genérica (segurança)

**Email Enviado:**
- ✉️ **Assunto:** "Nova Senha - PrimaCard Odonto"
- 📝 **Conteúdo:** Senha temporária em destaque
- ⚠️ **Orientações:** Trocar senha após login

---

### 3. **Notificação de Pontos** (PointsService)

**Integração:** Automática em `createTransaction()`

**Quando dispara:**
- Sempre que `delta > 0` (pontos creditados)

**Informações no Email:**
- 🎉 Quantidade de pontos ganhos
- 📋 Motivo do crédito
- 💰 Saldo total atualizado

**Motivos Mapeados:**
- `procedure_completed` → "Consulta concluída"
- `referral_reward` → "Indicação de amigo"
- `manual_adjustment` → "Ajuste manual"
- `punctuality_bonus` → "Bônus de pontualidade"
- `first_appointment` → "Primeira consulta"

---

### 4. **Notificação de Nova Consulta - Profissional** (AppointmentService)

**Integração:** Automática em `create()`

**Quando dispara:**
- Quando paciente cria novo agendamento

**Informações no Email:**
- 👤 Nome do paciente
- 🦷 Procedimento solicitado
- 📅 Data e horário completo

**Email Enviado:**
- ✉️ **Assunto:** "🔔 Nova Solicitação de Consulta"
- 📝 **Conteúdo:** Detalhes do agendamento
- 💡 **Ação:** Orientação para acessar o app

---

### 5. **Notificação de Consulta Confirmada - Paciente** (AppointmentService)

**Integração:** Automática em `accept()`

**Quando dispara:**
- Quando profissional aceita/confirma consulta
- Status muda de `REQUESTED` → `SCHEDULED`

**Informações no Email:**
- 👨‍⚕️ Nome do profissional
- 🦷 Procedimento confirmado
- 📅 Data e horário completo
- 📝 Orientações (chegar 10min antes, documento, etc.)

**Email Enviado:**
- ✉️ **Assunto:** "✅ Consulta Confirmada - PrimaCard Odonto"
- 📝 **Conteúdo:** Confirmação e orientações

---

### 6. **Notificação de Consulta Finalizada - Paciente** (AppointmentService)

**Integração:** Automática em `complete()`

**Quando dispara:**
- Quando profissional marca consulta como concluída
- Status muda para `COMPLETED`

**Informações no Email:**
- 👨‍⚕️ Nome do profissional
- 🦷 Procedimento realizado
- 🎉 Pontos ganhos (se aplicável)
- 💬 Convite para avaliação

**Email Enviado:**
- ✉️ **Assunto:** "🎊 Consulta Finalizada - Obrigado!"
- 📝 **Conteúdo:** Agradecimento e solicitação de feedback

---

## 🔧 Configuração

### Variáveis de Ambiente (`.env`)

```env
# Email (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=clinicardalegrete@gmail.com
SMTP_PASSWORD=sua_senha_de_aplicativo_aqui
```

⚠️ **Importante:** Use "Senha de Aplicativo" do Gmail, não a senha normal.

**Como gerar senha de aplicativo:**
1. Acesse https://myaccount.google.com/apppasswords
2. Crie uma senha para "Email"
3. Use essa senha no `.env`

---

## 🧪 Testes

### Teste Manual dos Templates

Execute o script de teste:

```bash
cd backend-primaCard
npx tsx src/scripts/test-email.ts
```

**O que testa:**
- ✅ Conexão com servidor SMTP
- ✅ Envio de todos os 5 templates
- ✅ Logs de sucesso/falha

**Email de teste:** rafaelnogueira.aluno@unipampa.edu.br

---

### Teste de Integração

1. **Recuperação de Senha:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"rafaelnogueira.aluno@unipampa.edu.br"}'
```

2. **Criar Consulta (dispara email ao profissional):**
- Use o app mobile/web para criar consulta
- Profissional receberá email automaticamente

3. **Aceitar Consulta (dispara email ao paciente):**
- Profissional aceita consulta via app
- Paciente receberá email de confirmação

4. **Finalizar Consulta (dispara 2 emails):**
- Profissional marca como concluída
- Paciente recebe: email de conclusão + email de pontos

---

## 📊 Logs

Todos os eventos de email são registrados:

**Sucesso:**
```
[info]: Email sent successfully to user@example.com. MessageId: <abc123>
[info]: Points credited notification sent to user@example.com: +50 points
```

**Falha:**
```
[error]: Failed to send email to user@example.com: Error message
```

**⚠️ Importante:** Falhas no envio de email **NÃO quebram** o fluxo principal (pontos, agendamentos, etc.)

---

## 🎨 Templates HTML

Todos os templates seguem o mesmo padrão visual:

**Estrutura:**
- 🎨 Header com gradiente (roxo/azul)
- 📄 Conteúdo principal com destaque
- 🔖 Badges para pontos
- 📋 Informações em blocos destacados
- 📱 Design responsivo

**Sem redirecionamentos:**
- ❌ Nenhum botão com link
- ✅ Apenas orientação para acessar o app

---

## ✨ Destaques da Implementação

1. **Não bloqueante:** Emails são enviados de forma assíncrona
2. **Resiliente:** Falhas não quebram funcionalidades principais
3. **Informativo:** Logs detalhados para debugging
4. **Seguro:** Não revela se email existe (forgot-password)
5. **Profissional:** Templates HTML de alta qualidade
6. **Automático:** Integração transparente com serviços existentes

---

## 📝 Checklist de Implementação

- [x] EmailService criado e configurado
- [x] Templates HTML responsivos
- [x] Recuperação de senha (forgot-password)
- [x] Notificação de pontos recebidos
- [x] Notificação de nova consulta (profissional)
- [x] Notificação de consulta confirmada (paciente)
- [x] Notificação de consulta finalizada (paciente)
- [x] Tratamento de erros robusto
- [x] Logs detalhados
- [x] Testes executados com sucesso

---

## 🚀 Próximos Passos (Opcional)

1. **Rate Limiting:** Limitar envios por usuário
2. **Queue System:** Usar fila (Bull/BullMQ) para emails
3. **Email Templates Database:** Templates editáveis no banco
4. **Unsubscribe:** Permitir usuário desativar notificações
5. **Email Analytics:** Tracking de aberturas e cliques

---

## 📞 Suporte

Em caso de problemas:

1. Verifique logs no console do backend
2. Confirme credenciais SMTP no `.env`
3. Teste conexão: `npx tsx src/scripts/test-email.ts`
4. Verifique se Gmail bloqueou o acesso

---

*Documentação gerada em 22/12/2025*
*Sistema de Email - PrimaCard Odonto v1.0*
