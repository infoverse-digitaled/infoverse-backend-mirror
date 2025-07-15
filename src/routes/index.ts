import { Router } from 'express';
import { helloController } from '../controllers';
import { authenticateJWT } from '../middleware/authMiddleware';
import courseRouter from './courseRoutes'; // clear name

const router = Router();

router.get('/', helloController);

router.get('/profile', authenticateJWT, (req, res) => {
  res.json({
    message: 'You are authorized!',
    user: (req as any).user,
  });
});

router.use('/courses', courseRouter); // now handles /api/courses

export default router;
