import { Router } from 'express';
import { helloController } from '../controllers';
import { authenticateJWT } from '../middleware/authMiddleware';
import courseRouter from './courseRoutes'; // clear name
import enrollmentRouter from './enrollmentRoutes';
import userRouter from './userRoutes';

const router = Router();

router.get('/', helloController);

router.get('/profile', authenticateJWT, (req, res) => {
  res.json({
    message: 'You are authorized!',
    user: (req as any).user,
  });
});

router.use('/courses', courseRouter); // now handles /api/courses
router.use('/', enrollmentRouter);
router.use('/users', userRouter); // now handles /api/users

export default router;
