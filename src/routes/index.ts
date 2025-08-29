import { Router } from 'express';
import { helloController } from '../controllers';
import { authenticateJWT } from '../middleware/authMiddleware';
import authRouter from './auth';
import courseRouter from './courseRoutes';
import enrollmentRouter from './enrollmentRoutes';
import userRouter from './userRoutes';
import reviewRouter from './reviewRoutes';
import adminRouter from './adminRoutes';

const router = Router();

router.get('/', helloController);

router.get('/profile', authenticateJWT, (req, res) => {
  res.json({
    message: 'You are authorized!',
    user: (req as any).user,
  });
});

router.use('/auth', authRouter);
router.use('/courses', courseRouter, reviewRouter, enrollmentRouter);
router.use('/users', userRouter);
router.use('/admin', adminRouter);

export default router;
