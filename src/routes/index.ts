import { Router } from 'express';
import { helloController } from '../controllers';
import authRouter from './auth';
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

router.use('/auth', authRouter);
router.use('/admin', adminRouter);
router.use('/oak', oakContentRouter);
router.use('/progress', oakProgressRouter);
router.use('/payment', paymentRouter);
router.use('/content', contentRouter);
router.use('/ai', aiRouter);
router.use('/public', publicRouter);
router.use('/school', schoolRouter);

export default router;
