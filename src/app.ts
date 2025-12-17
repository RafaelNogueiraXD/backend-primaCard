import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './config';
import logger from './config/logger';
import { errorHandler } from './middleware/errorHandler';

// Import routes
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/user.routes';
import professionalRoutes from './modules/professionals/professional.routes';
import professionalMeRoutes from './modules/professionals/professional-me.routes';
import appointmentRoutes from './modules/appointments/appointment.routes';
import procedureRoutes from './modules/procedures/procedure.routes';
import pointsRoutes from './modules/points/points.routes';
import rewardRoutes from './modules/rewards/reward.routes';
import referralRoutes from './modules/referrals/referral.routes';
import redemptionRoutes from './modules/redemptions/redemption.routes';
import reviewRoutes from './modules/reviews/review.routes';
import notificationRoutes from './modules/notifications/notification.routes';

const app: Application = express();

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PrimaCard API',
      version: '1.0.0',
      description: 'Healthcare appointment and rewards system API',
    },
    servers: [
      {
        url: `http://localhost:${config.port}/api/${config.apiVersion}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/modules/**/*.routes.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(helmet());
app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later',
});

app.use(limiter);

// Health check
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Routes
const apiRouter = express.Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/professionals', professionalRoutes);
apiRouter.use('/professional', professionalMeRoutes);
apiRouter.use('/appointments', appointmentRoutes);
apiRouter.use('/procedures', procedureRoutes);
apiRouter.use('/points', pointsRoutes);
apiRouter.use('/rewards', rewardRoutes);
apiRouter.use('/referrals', referralRoutes);
apiRouter.use('/redemptions', redemptionRoutes);
apiRouter.use('/reviews', reviewRoutes);
apiRouter.use('/notifications', notificationRoutes);

app.use(`/api/${config.apiVersion}`, apiRouter);

// 404 handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    errors: [{ message: 'Route not found', code: 'NOT_FOUND' }],
  });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
