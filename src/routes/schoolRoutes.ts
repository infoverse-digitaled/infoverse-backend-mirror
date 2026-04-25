import { Router } from 'express';
import { authenticateJWT, checkRole } from '../middleware/authMiddleware';
import { registerSchoolAdmin, getStudents } from '../controllers/schoolController';

const router = Router();

// Public route for school admin registration
router.post('/register', registerSchoolAdmin);

// Protected routes
router.use(authenticateJWT);
router.use(checkRole('schooladmin'));

router.get('/students', getStudents);

export default router;
