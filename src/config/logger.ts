import winston from 'winston';
import { config } from './index';

// Configuração de transports baseada no ambiente
const transports: winston.transport[] = [];

// Em serverless (Vercel), usar apenas Console
// Logs são automaticamente capturados pelo Vercel
if (config.env === 'production' || process.env.VERCEL === '1') {
  // Produção/Vercel: apenas console (JSON format)
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
    })
  );
} else {
  // Desenvolvimento: console colorido + arquivos (se possível)
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
          }`;
        })
      ),
    })
  );

  // Tentar adicionar file transports apenas em desenvolvimento local
  try {
    const fs = require('fs');
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs', { recursive: true });
    }
    transports.push(
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' })
    );
  } catch (error) {
    // Ignorar erro se não puder criar logs (ambiente read-only)
    console.warn('⚠️  Could not create log files (read-only filesystem)');
  }
}

const logger = winston.createLogger({
  level: config.logLevel,
  transports,
  // Não sair em erros não tratados (melhor para serverless)
  exitOnError: false,
});

export default logger;
