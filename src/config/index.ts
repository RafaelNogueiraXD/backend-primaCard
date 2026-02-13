import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiVersion: process.env.API_VERSION || 'v1',
  
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  database: {
    url: process.env.DATABASE_URL || '',
  },
  
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'noreply@primacard.com',
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000', 10),
  },
  
  otp: {
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
  },
  
  redemption: {
    holdExpiryDays: parseInt(process.env.REDEMPTION_HOLD_EXPIRY_DAYS || '7', 10),
  },
  
  punctuality: {
    toleranceMinutes: parseInt(process.env.PUNCTUALITY_TOLERANCE_MINUTES || '10', 10),
  },
  
  cancellation: {
    penaltyHours: parseInt(process.env.CANCELLATION_PENALTY_HOURS || '24', 10),
    lateCancelPenaltyPoints: parseInt(process.env.LATE_CANCEL_PENALTY_POINTS || '10', 10),
  },
  
  review: {
    windowDays: parseInt(process.env.REVIEW_WINDOW_DAYS || '7', 10),
  },
  
  referral: {
    pointsGeneral: parseInt(process.env.REFERRAL_POINTS_GENERAL || '20', 10),
    maxPerMonth: parseInt(process.env.REFERRAL_MAX_PER_MONTH || '10', 10),
  },
  
  adminApiKey: process.env.ADMIN_API_KEY || 'change-me',
  
  cors: {
    // Permite qualquer origem - útil para desenvolvimento
    origin: '*',
  },
  
  logLevel: process.env.LOG_LEVEL || 'info',
};
