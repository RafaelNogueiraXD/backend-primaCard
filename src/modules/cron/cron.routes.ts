import express from 'express';
import {
  verifyCronAuth,
  expireRedemptions,
  sendAppointmentReminders,
  cleanupExpiredTokens,
  generateDailyStats,
} from './cron.controller';

const router = express.Router();

/**
 * Rotas de Cron Jobs
 * 
 * IMPORTANTE: Configurar no vercel.json:
 * 
 * {
 *   "crons": [
 *     {
 *       "path": "/api/v1/cron/expire-redemptions",
 *       "schedule": "0 * * * *"
 *     },
 *     {
 *       "path": "/api/v1/cron/appointment-reminders",
 *       "schedule": "0 8 * * *"
 *     },
 *     {
 *       "path": "/api/v1/cron/cleanup-tokens",
 *       "schedule": "0 2 * * *"
 *     },
 *     {
 *       "path": "/api/v1/cron/daily-stats",
 *       "schedule": "0 23 * * *"
 *     }
 *   ]
 * }
 * 
 * Adicionar CRON_SECRET nas environment variables da Vercel
 */

// Todas as rotas requerem autenticação via bearer token
router.use(verifyCronAuth);

// Expirar resgates em HOLD (a cada hora)
router.post('/expire-redemptions', expireRedemptions);

// Enviar lembretes de consultas (diário às 8h)
router.post('/appointment-reminders', sendAppointmentReminders);

// Limpar tokens expirados (diário às 2h)
router.post('/cleanup-tokens', cleanupExpiredTokens);

// Gerar estatísticas diárias (diário às 23h)
router.post('/daily-stats', generateDailyStats);

export default router;
