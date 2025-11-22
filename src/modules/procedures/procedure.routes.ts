import { Router } from 'express';
import { ProcedureController } from './procedure.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new ProcedureController();

/**
 * @swagger
 * /procedures:
 *   post:
 *     summary: Create a new procedure (Professional only)
 *     tags: [Procedures]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - category
 *               - defaultDurationMinutes
 *               - pointsGeneral
 *               - pointsCategory
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Limpeza Dental"
 *               category:
 *                 type: string
 *                 example: "limpeza"
 *               description:
 *                 type: string
 *                 example: "Limpeza profissional completa"
 *               defaultDurationMinutes:
 *                 type: integer
 *                 example: 60
 *               pointsGeneral:
 *                 type: integer
 *                 example: 10
 *               pointsCategory:
 *                 type: integer
 *                 example: 15
 *     responses:
 *       201:
 *         description: Procedure created successfully
 *       400:
 *         description: Invalid data or duplicate name
 *       403:
 *         description: Not authorized
 */
router.post('/', authenticate, (req, res) => controller.create(req, res));

/**
 * @swagger
 * /procedures:
 *   get:
 *     summary: List all active procedures for authenticated professional
 *     tags: [Procedures]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of procedures
 *       403:
 *         description: Not authorized
 */
router.get('/', authenticate, (req, res) => controller.list(req, res));

/**
 * @swagger
 * /procedures/statistics:
 *   get:
 *     summary: Get procedure statistics (Professional only)
 *     tags: [Procedures]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Procedure statistics
 *       403:
 *         description: Not authorized
 */
router.get('/statistics', authenticate, (req, res) => controller.getStatistics(req, res));

/**
 * @swagger
 * /procedures/{id}:
 *   get:
 *     summary: Get procedure details (Professional only)
 *     tags: [Procedures]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Procedure details
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Procedure not found
 */
router.get('/:id', authenticate, (req, res) => controller.getById(req, res));

/**
 * @swagger
 * /procedures/{id}:
 *   put:
 *     summary: Update a procedure (Professional only)
 *     tags: [Procedures]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               defaultDurationMinutes:
 *                 type: integer
 *               pointsGeneral:
 *                 type: integer
 *               pointsCategory:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Procedure updated successfully
 *       400:
 *         description: Invalid data
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Procedure not found
 */
router.put('/:id', authenticate, (req, res) => controller.update(req, res));

/**
 * @swagger
 * /procedures/{id}:
 *   delete:
 *     summary: Deactivate a procedure (Professional only)
 *     tags: [Procedures]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Procedure deactivated successfully
 *       400:
 *         description: Cannot delete procedure with active appointments
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Procedure not found
 */
router.delete('/:id', authenticate, (req, res) => controller.delete(req, res));

export default router;
