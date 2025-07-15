import { Router } from 'express';
import { helloController } from '../controllers';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

// Public route
router.get('/', helloController);

// Protected route
router.get('/profile', authenticateJWT, (req, res) => {
  res.json({
    message: 'You are authorized!',
    user: (req as any).user,
  });
});

export default router;
