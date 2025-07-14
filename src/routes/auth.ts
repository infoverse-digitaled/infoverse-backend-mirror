import { Router } from 'express';
import { register, login } from '../controllers/authController';

const router = Router();

router.post('/test', (_req, res) => res.json({ ok: true }));
router.post('/register', register);
router.post('/login', login);

export default router;
