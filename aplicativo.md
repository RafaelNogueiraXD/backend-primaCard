Lógico do PrimaCard

Introdução
O PrimaCard é um aplicativo que possibilita a criação de um sistema de pontuação entre pacientes e profissionais da saúde, baseado na realização de consultas, procedimentos e avaliações mútuas. A plataforma promove engajamento, fidelização e colaboração entre usuários e prestadores de serviço, permitindo que pacientes acumulem pontos por ações como indicações, pontualidade e realização de procedimentos, enquanto os profissionais podem personalizar regras e recompensas dentro de suas práticas.
A lógica do PrimaCard foi cuidadosamente projetada para atender às necessidades reais de consultórios e clínicas, assegurando organização, segurança e justiça em todos os processos. Desde o agendamento de consultas com verificação de disponibilidade e prevenção de conflitos de horário até o registro histórico de atendimentos, avaliações e pontuações, o sistema contribui para uma experiência integrada e intuitiva. Com esse modelo, o PrimaCard oferece uma abordagem moderna e gamificada ao cuidado em saúde, fortalecendo relações de confiança e incentivando comportamentos positivos entre todos os envolvidos.


Lógica
Aqui ficará qual é a lógica por cada função dentro do Prima card
Lógica das consultas
Formas que se pode criar um agendamento: 	
Um usuário solicita o agendamento de uma consulta e o profissional aceita
Um profissional pode criar uma consulta com um paciente de forma arbitrária
Validações:
Evitar double booking do profissional e do paciente (lock otimista por [profissional_id, intervalo]).
Respeitar janelas de atendimento (horário de trabalho, feriados, buffers).
Duração do procedimento (não apenas data/hora de início).
Timezone consistente (grave timestamps em UTC + timezone do local; cuidado com DST).
Lógica dos Procedimentos
	
Como a consulta se encerra?
Depois que passa a data e hora a consulta é encerrada
O usuário tem 7 dias para avaliar o profissional naquela consulta
O profissional tem 7 dias para avaliar o usuário naquela consulta
A consulta deve ficar no histórico de consultas de ambos os usuários
Os pontos devem ser computados ao paciente e só após o feedback do profissional
Se o profissional não avaliar em 7 dias, os pontos do paciente devem ser concedidos automaticamente? Sim, o usuário ganha os pontos do procedimento, pontos por ter chegado no horário.




Atributos mínimos da consulta:
id, profissional_id, paciente_id, procedimento_id,  data_hora_inicio, data_hora_fim, local, status, created_by, snapshot do procedimento (nome/versão/pontos no momento).

Encerramento:
Hoje: “Depois que passa a data e hora a consulta é encerrada”. Sugestão: Estados e transições:
scheduled → in_progress (no check-in) → completed (check-out do profissional) OU auto-completed (se passou do fim + tolerância).
scheduled → no_show_patient (se paciente não comparece).
scheduled → canceled_by_patient / canceled_by_professional (respeitar políticas e janelas).
Check-in e pontualidade:
Defina tolerância (ex.: ±5 min).
Preferível check-in do paciente no app (geofence + hora do servidor).
O profissional pode confirmar/ajustar, mas registre ambas as fontes para auditoria.
Avaliações:
Janela de 7 dias para ambos. E se uma parte não avaliar?
Sugestão: após 7 dias, feche a janela; seus pontos ligados à avaliação (se houver) devem ter fallback:
Se “pontos do paciente só após feedback do profissional”: programe auto-atribuição após 7 dias se o profissional não avaliar (evita bloqueio indevido).
Histórico:
A consulta deve estar no histórico de ambos com status final (completed, no_show, canceled…).
Cancelamento e remarcação:
Regras de corte (ex.: até 24h antes; após isso vira “late cancel”).
Penalidades/impacto em pontos (ex.: -X pontos em no-show ou late cancel?).
Remarcação deve gerar nova consulta (link ao original) ou atualizar mantendo auditoria.
Observabilidade e antifraude:
Logs de quem criou/alterou/aceitou/cancelou com timestamp e IP/agent.
Idempotência nas ações (evitar criação duplicada).


		
Lógica dos Procedimentos

Como se criam os Pontos
		O usuário ganha pontos por: Indicar alguém, Chegar no horário exato da consulta(quem determina se ele chegou no horário é o profissional), realizar procedimento através de uma consulta.
		
Os pontos são diferentes
		O usuário pode ter diferentes pontos, ele terá os pontos gerais porém terá pontos específicos por exemplo: "João realiza um clareamento" através desse procedimento ele ganhará pontos gerais por chegar no horário porém ganhará pontos específicos de clareamento, então em sua conta aparecerá "Pontos gerais 10; Pontos de clareamento 15"
Criação/gerência:
Pertencem ao profissional (ou à clínica) com versionamento: procedure_id + version.
Campos: nome, duração padrão, pontos gerais, pontos específicos (categoria), ativo/inativo.
Snapshot:
Ao agendar/atender, salve snapshot dos pontos, nome e duração para evitar mudanças retroativas afetarem históricos/pontos.
Categorias:
Defina “categoria de pontos” do procedimento (ex.: clareamento), usada nos “pontos específicos”.

Lógica dos Pontos
Como se criam os Pontos
		O usuário ganha pontos por: Indicar alguém, Chegar no horário exato da consulta(quem determina se ele chegou no horário é o profissional), realizar procedimento através de uma consulta.
		
Os pontos são diferentes
		O usuário pode ter diferentes pontos, ele terá os pontos gerais porém terá pontos específicos por exemplo: "João realiza um clareamento" através desse procedimento ele ganhará pontos gerais por chegar no horário porém ganhará pontos específicos de clareamento, então em sua conta aparecerá "Pontos gerais 10; Pontos de clareamento 15"

Origem dos pontos:
Indicação (referral) — defina regras:
Quando conta? Ao primeiro atendimento concluído do indicado? Evite autoindicação/loop.
Cap por mês/ano; validação de unicidade do indicado.
Pontualidade — defina tolerância e fonte de verdade (hora do servidor + check-in no local).
Procedimento — concedido após conclusão e regra da avaliação (ver fallback).
Buckets de pontos:
Geral (acumula tudo) e Específicos por categoria (ex.: Clareamento).
Mantenha ledger de transações:
points_transactions: id, user_id, bucket (general|categoria), delta, cause (referral|puntualidade|procedimento|ajuste|resgate), reference_id (consulta/resgate), created_at.
Suporte a ajustes (deltas negativos), estornos (refunds) e expiração (opcional).
Contabilização:
Evite computar duas vezes: use eventos idempotentes (event_id, processed_at).
Se depender do feedback do profissional, agende job: ao fechar janela de 7 dias, ou quando feedback ocorrer (o que vier primeiro).
Limites e abuso:
Rate limits para referrals.
Auditoria no “chegar no horário”.
Revisões anômalas (padrões suspeitos) podem marcar para moderação.

Lógica dos Recompensas
Criação:
Defina custo em pontos (pode ser em “geral” ou em múltiplos buckets).
Exclusões e inclusões:
Em vez de só “qual procedimento não pode ser usado”, modelem:
allowed_buckets (lista explicitando quais buckets podem pagar).
excluded_buckets (lista dos proibidos).
Ex.: “vale clareamento”: excluded_buckets = [clareamento]; allowed_buckets = [general, outras categorias].
Escopo: recompensa é do profissional X (rede local) ou global? Bloqueie resgate com pontos de outro profissional se necessário.
Resgate:
Estados: requested → hold (bloqueia pontos) → ready_for_pickup → redeemed → expired/canceled.
Hold de pontos:
Ao clicar “Resgatar”, debite via hold (reserva) para impedir gasto duplo.
Se não resgatar até X dias, expire e devolva os pontos (unhold).
Confirmação no local:
Valide com QR/OTP gerado no momento do resgate (válido por poucos minutos).
Profissional confirma no sistema → estado = redeemed → ledger: débito final.
Reversões:
Se marcado por engano, permita refund com auditoria (cria transação inversa).
Algoritmo de débito por buckets:
Defina ordem: ex.: usar pontos específicos permitidos primeiro, depois geral.
Se recompensa proíbe um bucket, pule-o.
Se custo > saldo permitido, bloqueie resgate com mensagem clara.
Avaliações (Feedback)

Janela de 7 dias para cada parte.
Itens de avaliação:
Nota (1–5), tags (pontualidade, atendimento, qualidade), comentário moderável.
Lógica de pontos atrelados a feedback:
Se pontos dependem do feedback do profissional, defina fallback automático ao fim da janela.
Prevenção de abuso:
Limitar edição/deleção de avaliações.
Moderação para linguagem inadequada.
Modelo de Dados
users: id, role (patient|professional), …
professionals: id (FK user), settings (horários), …
procedures: id, professional_id, name, category, default_duration_min, points_general, points_category, version, active
appointments: id, professional_id, patient_id, status, starts_at_utc, ends_at_utc, procedure_snapshot(json), created_by, canceled_by, canceled_reason, checkin_at, checkout_at
reviews: id, appointment_id, author_user_id, target_user_id, rating, comment, created_at
points_transactions: id, user_id, bucket (general|categoria), delta, cause, reference_type, reference_id, created_at, metadata
rewards: id, professional_id, name, cost_points, allowed_buckets[], excluded_buckets[], active, terms
redemptions: id, reward_id, user_id, status, hold_breakdown(json por bucket), requested_at, expires_at, redeemed_at, canceled_at, otp/qr_token_hash
referrals: id, referrer_user_id, referred_user_id, status, awarded_at, rule_version
audit_logs: id, actor_user_id, action, entity_type, entity_id, data_before, data_after, created_at
domain_events (opcional): idempotency_key, type, payload, processed_at




Pontualidade:

Tolerância: 10 minutos após o horário marcado.
Sem geolocalização: apenas marcação do profissional (check-in manual).
Critérios:
Paciente é considerado pontual se arrival_time <= starts_at + 10min.
Pode haver também bônus extra se arrival_time == starts_at (se quiser distinguir “exato” vs “dentro da tolerância”; defina isso).

Cancelamentos:
Cancelar antes de 24h da consulta: sem penalidade.
Cancelar dentro das 24h: penalidade de pontos (definir valor).
Opcional: se cancelar dentro de uma janela muito curta (ex.: <1h), quer que seja “late_cancel” diferente? (Ver pendente).
Não mostrar como no-show se cancelou (mesmo em cima da hora) — mas aplica penalidade como “late_cancel”. Confirma?
Recompensas:
Podem consumir pontos específicos e, se faltar, complementam com pontos gerais.
Buckets excluídos NÃO podem ser usados.
Ordem de consumo: (1) Somatório dos buckets específicos permitidos, (2) Geral.
Sem procedimentos múltiplos por consulta → simplifica snapshots.
Pontos:

Sem geolocalização nem verificação automática → aumentar atenção a antifraude na marcação do profissional.
Escopo dos pontos:

Global: um usuário pode usar pontos obtidos com procedimento de Profissional A para resgatar recompensa de Profissional B (salvo exclusões).
Logo, buckets são do usuário e não segmentados por profissional.


Telas e rotas
Abaixo segue uma especificação abrangente das TELAS (front React Native) e das ROTAS (backend) para o aplicativo, contemplando lado do Usuário (Paciente) e lado do Especialista (Profissional). Estruturei para servir como base de backlog e facilitar geração de componentes, navegação e APIs.

------------------------------------------------------------------
PARTE 1: TELAS (React Native)
------------------------------------------------------------------

Organização sugerida de navegação:
- Stack raiz com autenticação e onboarding.
- Tabs distintas para Paciente e Profissional após login (role-based).
- Modais para fluxos pontuais (resgate, avaliação, confirmação).
- Contextos globais: sessão, pontos, notificações, cache de procedimentos.

Legenda de tipos:
(P) Paciente
(R) Profissional (“especialista”)
(A) Ambos

1. Tela Splash / Boot (A)
   - Verifica token, versão mínima, migrações locais.
   - Estados: carregando, erro (atualização obrigatória).
2. Login (A)
   - Campos: e-mail/telefone, senha.
   - Ações: Login, Esqueci senha, Ir para cadastro.
3. Cadastro (A)
   - Fluxo diferenciado:
     - Paciente: nome, sobrenome, e-mail, telefone, senha, consentimentos.
     - Profissional: dados pessoais + registro profissional (ex: CRO), categoria, endereço de atendimento.
   - Passo de verificação de e-mail/telefone (OTP).
4. Recuperar Senha (A)
   - Entrada e-mail/telefone → envio código → redefinir.
5. Onboarding / Tutorial (P opcional)
   - Slides sobre como marcar consulta, ganhar pontos, resgatar recompensas.
6. Seleção de Perfil (A se conta tiver ambos papéis)
   - Escolher "Entrar como Paciente" ou "Entrar como Profissional".
7. Home Paciente (P)
   - Resumo: próxima consulta, saldo de pontos (geral e por categorias em destaque), recompensas recomendadas.
   - Acesso rápido: Agendar, Recompensas, Histórico.
8. Home Profissional (R)
   - Agenda do dia (slots), pendências: solicitações de consulta, avaliações não feitas, resgates para confirmar.
   - KPIs rápidos: nº consultas semana, no-shows, recompensas resgatadas.
9. Lista de Consultas / Agenda (A)
   - Visões: Dia / Semana / Mês.
   - Filtro: status, paciente, procedimento.
   - Ações:
     - Paciente: abrir detalhes, solicitar cancelamento.
     - Profissional: marcar no-show, cancelar, iniciar (opcional), completar.
10. Detalhe da Consulta (A)
    - Dados: profissional/paciente, procedimento (snapshot), horário, status, pontualidade.
    - Ações:
      - Paciente: cancelar (se permitido), avaliar (se dentro da janela).
      - Profissional: marcar chegada do paciente (pontual / dentro tolerância / atrasado / no-show), concluir consulta, avaliar paciente.
11. Solicitar Agendamento (P)
    - Escolha: Profissional → Procedimento → Data/hora (slots disponíveis).
    - Envia solicitação (status requested → pending_acceptance).
12. Aceitar / Gerenciar Solicitação (R)
    - Lista de solicitações pendentes.
    - Botões: aceitar, rejeitar (motivo).
13. Criar Consulta Direta (R)
    - Profissional seleciona paciente (busca), procedimento, data/hora.
    - Confirma e gera consulta scheduled.
14. Marcar Pontualidade (R, integrável ao Detalhe)
    - Botões: “Chegou agora” → define arrival_time.
    - Calcula status de pontualidade (EXATA / TOLERÂNCIA / ATRASO / NO_SHOW).
15. Avaliação Pós-Consulta (A)
    - Dentro da janela de 7 dias.
    - Campos: nota (1–5), tags (opcional), comentário.
    - Estado: pendente / enviada / expirada.
16. Histórico de Consultas (A)
    - Lista paginada com filtros por status, período.
    - Mostrar se avaliação feita ou não.
17. Painel de Pontos (P)
    - Saldo geral + lista de categorias (ex: clareamento, limpeza).
    - Histórico de transações (infinite scroll): causa, delta, data.
18. Painel de Pontos Pacientes (R)
    - Busca de paciente → ver saldos e transações daquele paciente (somente leitura).
19. Procedimentos do Profissional (R)
    - Lista de procedimentos ativos/inativos.
    - Ações: criar, editar, inativar.
20. Criar/Editar Procedimento (R)
    - Campos: nome, categoria, duração padrão, pontos gerais, pontos específicos, ativo.
    - Snapshot gerado automaticamente em consultas futuras.
21. Loja de Recompensas (A)
    - Lista de recompensas disponíveis (global ou por profissional).
    - Filtros: custo, categorias bloqueadas, novidades.
22. Detalhe de Recompensa (A)
    - Nome, custo, buckets excluídos, termos.
    - Botão “Resgatar”.
23. Confirmação de Resgate (P)
    - Mostra breakdown de consumo (quais buckets).
    - Alertas sobre expiração do hold.
24. Histórico de Resgates (P)
    - Estados: HOLD, REDEEMED, EXPIRED, CANCELED.
    - Detalhe com data, pontos usados.
25. Validação de Resgate (R)
    - Lista de holds aguardando confirmação.
    - Entrada de OTP/QR (se implementado).
    - Botão “Confirmar Resgate”.
26. Criar Recompensa (R ou Admin)
    - Campos: nome, custo, buckets excluídos, ativo, termos.
27. Editar Recompensa (R/Admin)
    - Atualizar custo, ativar/desativar.
28. Indicação (Referral) (P)
    - Campo para indicar e-mail/telefone de amigo.
    - Status de cada indicação: pendente → concluída (após primeira consulta).
29. Dashboard de Indicações (R opcional / Admin)
    - Controle de fraudes (lista indicações recentes).
30. Perfil do Usuário (P)
    - Dados pessoais, editar contato, preferências de notificação.
31. Perfil do Profissional (R)
    - Dados públicos: nome, especialização, rating médio.
    - Configurações de agenda (horários disponíveis).
32. Configurar Horários (R)
    - Definição de janelas semanais, feriados, bloqueios.
33. Notificações (A)
    - Lista (consulta amanhã, avaliação pendente, resgate expirando).
34. Central de Mensagens / Suporte (A opcional)
    - Ticket para suporte interno (não essencial MVP).
35. Tela de Auditoria / Log (Admin) (opcional)
    - Listar ações sensíveis.
36. Tela de Relatórios (R/Admin) (futuro)
    - Estatísticas de no-show, uso de recompensas, pontos concedidos.
37. Ajuste Manual de Pontos (Admin) (opcional)
    - Escolher usuário, bucket, delta, motivo.
38. Termos e Política / Consentimentos (A)
    - Exibir e aceitar.
39. Sair / Trocar Perfil (A)
    - Confirmação.
40. Erros e Estados Vazios (A componente genérico)
    - Placeholder para listas vazias, timeouts.

Componentes transversais:
- Modal de confirmação genérica
- Banner de alerta (penalidade, expiração)
- Card de consulta / card de recompensa / card de pontos
- Picker de data/hora com slots
- Indicador de status (chips)
- Skeleton loaders

------------------------------------------------------------------
PARTE 2: ROTAS BACKEND (API REST)
------------------------------------------------------------------

Convenções:
- Base URL: /api/v1
- Autenticação: Bearer JWT.
- Respostas padronizadas: { data, meta, errors }
- Filtros/paginação padrão: ?page=1&per_page=20&sort=created_at:desc
- Idempotency-Key header em POST críticos (criação de consulta, resgate).
- Todas datas em ISO8601 UTC.
- Campos enumerados documentados.

Agrupadas por domínio.

1. Auth
POST /auth/register (role, dados)  
POST /auth/login (email, senha)  
POST /auth/refresh  
POST /auth/forgot-password  
POST /auth/reset-password  
POST /auth/verify-otp  
POST /auth/logout  

2. Usuários / Perfil
GET /users/me  
PATCH /users/me  
GET /users/{id} (visão pública limitada)  
PATCH /users/me/preferences  
GET /users/search?query= (para profissional buscar paciente)  

3. Profissionais
GET /professionals/{id}  
GET /professionals?specialty=&query=  
PATCH /professionals/{id} (próprio)  
GET /professionals/{id}/procedures  
GET /professionals/{id}/availability?date=YYYY-MM-DD  
PATCH /professionals/{id}/schedule (slots, bloqueios)  

4. Procedimentos
POST /procedures  
GET /procedures?active=  
GET /procedures/{id}  
PATCH /procedures/{id}  
DELETE /procedures/{id} (soft delete / inativar)  

5. Consultas (Appointments)
POST /appointments (paciente solicita ou profissional cria; body inclui professional_id, procedure_id, starts_at)  
GET /appointments?status=&from=&to=&professional_id=&patient_id=  
GET /appointments/{id}  
PATCH /appointments/{id}/accept (profissional)  
PATCH /appointments/{id}/cancel (actor, motivo)  
PATCH /appointments/{id}/mark-arrival (profissional; body arrival_marked_at opcional)  
PATCH /appointments/{id}/complete (profissional)  
PATCH /appointments/{id}/mark-no-show (profissional)  
GET /appointments/{id}/snapshot (procedimento snapshot; ou já embutido)  

6. Avaliações (Reviews)
POST /appointments/{id}/reviews (autor avalia alvo)  
GET /appointments/{id}/reviews  
GET /users/{id}/reviews?role=target  
DELETE /reviews/{id} (moderação/admin)  

7. Pontos (Points)
GET /points/me (salto por bucket)  
GET /users/{id}/points (profissional/admin consultar paciente)  
GET /points/me/transactions?page=&cause=&bucket=  
POST /points/adjust (admin; body: user_id, bucket, delta, motivo)  
GET /points/transactions/{id}  

8. Recompensas (Rewards)
POST /rewards  
GET /rewards?active=&owner_professional_id=  
GET /rewards/{id}  
PATCH /rewards/{id}  
DELETE /rewards/{id} (inativar)  

9. Resgates (Redemptions)
POST /rewards/{id}/redeem (gera HOLD; retorna breakdown)  
GET /redemptions?status=&user_id=  
GET /redemptions/{id}  
PATCH /redemptions/{id}/confirm (profissional; exige otp_code)  
PATCH /redemptions/{id}/cancel (usuário)  
PATCH /redemptions/{id}/expire (job interno ou admin)  
POST /redemptions/{id}/refund (admin/profissional)  

10. Indicações (Referrals)
POST /referrals (body: contact info indicado)  
GET /referrals?status=&referrer_user_id=  
GET /referrals/{id}  
PATCH /referrals/{id}/mark-completed (sistema/job quando primeira consulta concluída)  

11. Disponibilidade / Agenda
GET /availability?professional_id=&procedure_id=&date=  
GET /slots?professional_id=&from=&to= (gerado via regras, usado para agendamento)  

12. Notificações
GET /notifications?unread=  
PATCH /notifications/{id}/read  
PATCH /notifications/read-all  
POST /notifications/test (admin)  

13. Auditoria / Logs (Admin)
GET /audit?entity_type=&entity_id=&action=&from=&to=  
GET /audit/{id}  

14. Relatórios (Admin / Profissional)
GET /reports/appointments/summary?from=&to=  
GET /reports/points/summary?from=&to=&user_id=  
GET /reports/redemptions/summary?from=&to=  
GET /reports/no-show-rates?from=&to=&professional_id=  

15. Sistema / Meta
GET /system/enums (lista de enums publicadas: appointment_status, redemption_status, causes, buckets)  
GET /system/health  
GET /system/version  

16. Jobs / Internos (Protegidos por chave interna ou role)
POST /jobs/appointments/close-evaluation-window (executar fechamento lote)  
POST /jobs/redemptions/expire-holds  
POST /jobs/points/fallback-grant  

17. Segurança / OTP (para resgates)
POST /redemptions/{id}/generate-otp  
POST /redemptions/{id}/verify-otp  

18. Feature Flags (opcional)
GET /feature-flags  
PATCH /feature-flags/{key}  

19. Exportações / Data (LGPD)
POST /users/me/export (gera pacote de dados)  
POST /users/me/request-delete (solicitar exclusão)  

ENUMS (exemplo para /system/enums resposta)
appointment_status: [requested, scheduled, canceled_by_patient, canceled_by_professional, completed, no_show_patient, no_show_professional, auto_completed]  
redemption_status: [HOLD, REDEEMED, EXPIRED, CANCELED, REFUNDED]  
punctuality_flag: [EXACT, WITHIN_TOLERANCE, LATE, NO_SHOW]  
points_cause: [PROCEDURE_COMPLETED, REFERRAL_COMPLETED, PUNCTUAL, EXACT_TIME, LATE_CANCEL_PENALTY, NO_SHOW_PENALTY, REWARD_REDEMPTION, ADMIN_ADJUSTMENT]  

Exemplo de Resposta Padrão (GET /appointments/{id})
{
  "data": {
    "id": "apt_123",
    "status": "completed",
    "procedure": {
      "id": "proc_88",
      "snapshot": {
        "name": "Clareamento",
        "category": "clareamento",
        "points_general": 10,
        "points_category": 15,
        "version": 2
      }
    },
    "professional_id": "usr_prof_77",
    "patient_id": "usr_pat_55",
    "starts_at": "2025-11-20T14:00:00Z",
    "ends_at": "2025-11-20T14:30:00Z",
    "punctuality_flag": "WITHIN_TOLERANCE",
    "arrival_marked_at": "2025-11-20T14:07:00Z",
    "review_status_patient": "pending",
    "review_status_professional": "submitted",
    "completed_at": "2025-11-20T14:31:20Z"
  },
  "meta": {},
  "errors": []
}

Fluxo crítico com idempotência (POST /rewards/{id}/redeem)
Headers: Idempotency-Key: <uuid>  
Body:
{
  "confirm_preview": false
}
Resposta:
{
  "data": {
    "redemption_id": "red_999",
    "status": "HOLD",
    "reward_id": "rew_44",
    "breakdown": [
      {"bucket": "clareamento", "points": 8},
      {"bucket": "general", "points": 12}
    ],
    "expires_at": "2025-11-25T12:00:00Z"
  }
}

Validação de pontualidade (PATCH /appointments/{id}/mark-arrival)
Body:
{
  "arrival_marked_at": "2025-11-20T14:04:00Z"
}
Resposta calcula:
{
  "data": {
    "punctuality_flag": "WITHIN_TOLERANCE",
    "arrival_marked_at": "2025-11-20T14:04:00Z",
    "tolerance_minutes": 10
  }
}

------------------------------------------------------------------
INTERAÇÕES PRINCIPAIS (Resumo de Fluxos)
------------------------------------------------------------------

Agendamento (Paciente solicita):
1. POST /appointments (requested)
2. Profissional aceita → PATCH /appointments/{id}/accept (scheduled)
3. Chegada → PATCH /appointments/{id}/mark-arrival
4. Conclusão → PATCH /appointments/{id}/complete
5. Avaliações → POST /appointments/{id}/reviews
6. Fallback pontos via job se profissional não avaliou.

Resgate de Recompensa:
1. POST /rewards/{id}/redeem → HOLD
2. Profissional confirma → PATCH /redemptions/{id}/confirm (+ OTP)
3. Expiração automática se não confirmado → job → EXPIRED (libera pontos)

Cancelamento tardio:
1. PATCH /appointments/{id}/cancel (valida diferença <24h)
2. Cria transação de penalidade (LATE_CANCEL_PENALTY)

Indicação:
1. POST /referrals
2. Quando indicado completa primeira consulta → PATCH /referrals/{id}/mark-completed
3. Pontos gerados (REFERRAL_COMPLETED)


