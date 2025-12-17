import { Router } from 'express';
import { ProfessionalController } from './professional.controller';
import { authenticate } from '../../middleware/auth';
import { authorizeRoles } from '../../middleware/roleAuth';

const router = Router();
const professionalController = new ProfessionalController();

// All routes here require authentication and PROFESSIONAL role
router.use(authenticate);
router.use(authorizeRoles(['PROFESSIONAL']));

router.get('/dashboard', professionalController.getDashboard.bind(professionalController));
router.get('/clients', professionalController.getClients.bind(professionalController));
router.get('/reviews', professionalController.getMyReviews.bind(professionalController));

export default router;
