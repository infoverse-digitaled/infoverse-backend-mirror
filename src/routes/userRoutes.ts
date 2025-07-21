import express from 'express';
import { getUserProfile, updateUserProfile } from '../controllers/usercontroller';
import { authenticateJWT } from '../middleware/authMiddleware';

const userRouter = express.Router();

userRouter.get('/me/profile', authenticateJWT, getUserProfile);
userRouter.put('/me/profile', authenticateJWT, updateUserProfile);

export default userRouter;
