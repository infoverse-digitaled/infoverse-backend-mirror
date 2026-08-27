import { Router } from 'express';
import { helloController } from '../controllers';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/authMiddleware';
import authRouter from './auth';
import courseRouter from './courseRoutes';
import enrollmentRouter from './enrollmentRoutes';
import userRouter from './userRoutes';
import reviewRouter from './reviewRoutes';
import adminRouter from './adminRoutes';
import oakContentRouter from './oakContent';
import oakProgressRouter from './oakProgress';
import paymentRouter from './payment';
import contentRouter from './contentRoutes';
import aiRouter from './aiRoutes';
import publicRouter from './publicRoutes';
import schoolRouter from './schoolRoutes';

const router = Router();

router.get('/', helloController);

router.get('/profile', authenticateJWT, (req, res) => {
  res.json({
    message: 'You are authorized!',
    user: (req as AuthenticatedRequest).user,
  });
});

router.use('/auth', authRouter);
router.use('/courses', courseRouter);
router.use('/courses', reviewRouter);
router.use('/courses', enrollmentRouter);
router.use('/users', userRouter);
router.use('/admin', adminRouter);
router.use('/oak', oakContentRouter);
router.use('/progress', oakProgressRouter);
router.use('/payment', paymentRouter);
router.use('/content', contentRouter);
router.use('/ai', aiRouter);
router.use('/public', publicRouter);
router.use('/school', schoolRouter);

export default router;
