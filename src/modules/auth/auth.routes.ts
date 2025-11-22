import { Router } from 'express';
import { body } from 'express-validator';
import { AuthController } from './auth.controller';
import { validate } from '../../middleware/validation';
import { authenticate } from '../../middleware/auth';

const router = Router();
const authController = new AuthController();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *               - phone
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 example: paciente@email.com
 *               password:
 *                 type: string
 *                 example: Senha123!@#
 *               firstName:
 *                 type: string
 *                 example: João
 *               lastName:
 *                 type: string
 *                 example: Silva
 *               phone:
 *                 type: string
 *                 example: 11999999999
 *               role:
 *                 type: string
 *                 enum: [PATIENT, PROFESSIONAL]
 *                 example: PATIENT
 *               registrationNumber:
 *                 type: string
 *                 description: Required for PROFESSIONAL role (CRO, etc)
 *                 example: CRO-SP 12345
 *               specialty:
 *                 type: string
 *                 description: Required for PROFESSIONAL role
 *                 example: Ortodontia
 *     responses:
 *       201:
 *         description: User registered successfully
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('role').isIn(['PATIENT', 'PROFESSIONAL']).withMessage('Role must be PATIENT or PROFESSIONAL'),
    body('registrationNumber').optional().trim(),
    body('specialty').optional().trim(),
  ],
  validate,
  authController.register.bind(authController)
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate,
  authController.login.bind(authController)
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 */
router.post(
  '/refresh',
  [body('refreshToken').notEmpty()],
  validate,
  authController.refresh.bind(authController)
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/logout',
  authenticate,
  authController.logout.bind(authController)
);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 */
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  validate,
  authController.forgotPassword.bind(authController)
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password with OTP
 *     tags: [Auth]
 */
router.post(
  '/reset-password',
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }),
    body('newPassword').isLength({ min: 8 }),
  ],
  validate,
  authController.resetPassword.bind(authController)
);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Verify email with OTP
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/verify-otp',
  authenticate,
  [body('otp').isLength({ min: 6, max: 6 })],
  validate,
  authController.verifyOtp.bind(authController)
);

export default router;
