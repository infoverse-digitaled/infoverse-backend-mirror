import { Request, Response } from 'express';
import * as paystackService from '../services/paystackService';
import User from '../models/User';
import { PAYSTACK_PLANS } from '../config/paystack';

// Type guard or helper to find plan key from code could be useful,
// but for now we map all paid plans to 'premium' in the User model.

export const startTrial = async (req: Request, res: Response) => {
  try {
    const { planCode } = req.body;
    const user = (req as any).user;

    if (!user || !user.email) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Validate planCode
    const isValidPlan = Object.values(PAYSTACK_PLANS).some((p) => p.code === planCode);
    if (!isValidPlan) {
      return res.status(400).json({ error: 'Invalid plan code' });
    }

    const initializationData = await paystackService.initializeCardValidation(user.email, planCode);

    res.status(200).json({
      message: 'Authorization URL created',
      authorizationUrl: initializationData.data.authorization_url,
      reference: initializationData.data.reference,
    });
  } catch (error: any) {
    console.error('Start Trial Error:', error);
    res.status(500).json({ error: error.message || 'Failed to start trial' });
  }
};

export const verifyTrial = async (req: Request, res: Response) => {
  try {
    const { reference } = req.body;
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const subscriptionData = await paystackService.verifyAndCreateTrial(reference);

    // Calculate trial end date (7 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    // Update User
    await User.findByIdAndUpdate(user.id, {
      'subscription.status': 'trialing',
      'subscription.plan': 'premium', // Assuming all Paystack plans are premium
      'subscription.trialEndsAt': trialEndsAt,
      // We might want to store the Paystack subscription code/token if needed later
    });

    res.status(200).json({
      message: 'Trial started successfully',
      subscription: subscriptionData.data,
    });
  } catch (error: any) {
    console.error('Verify Trial Error:', error);
    res.status(500).json({ error: error.message || 'Failed to verify trial' });
  }
};
