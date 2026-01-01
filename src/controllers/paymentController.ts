import { Request, Response } from 'express';
import * as paystackService from '../services/paystackService';
import User from '../models/User';
import { PAYSTACK_PLANS } from '../config/paystack';
import { successResponse } from '../middleware/response';

// Type guard or helper to find plan key from code could be useful,
// but for now we map all paid plans to 'premium' in the User model.

/**
 * Start a 14-day cardless free trial
 * No credit card required - user gets immediate access
 */
export const startTrial = async (req: Request, res: Response) => {
  try {
    const { planCode } = req.body;
    const user = (req as any).user;

    if (!user || !user.email) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user already has an active subscription
    if (user.subscription?.status === 'active') {
      return res.status(400).json({ error: 'You already have an active subscription' });
    }

    // Check if user is already trialing
    if (user.subscription?.status === 'trialing') {
      const trialEndsAt = user.subscription.trialEndsAt;
      if (trialEndsAt && new Date(trialEndsAt) > new Date()) {
        return res.status(400).json({
          error: 'You already have an active trial',
          trialEndsAt: trialEndsAt
        });
      }
    }

    // Validate planCode (optional - store for when they convert)
    if (planCode) {
      const isValidPlan = Object.values(PAYSTACK_PLANS).some((p) => p.code === planCode);
      if (!isValidPlan) {
        return res.status(400).json({ error: 'Invalid plan code' });
      }
    }

    // Calculate trial end date (14 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    // Update user with trial subscription
    await User.findByIdAndUpdate(user.id, {
      'subscription.status': 'trialing',
      'subscription.plan': 'premium',
      'subscription.trialEndsAt': trialEndsAt,
    });

    res.status(200).json({
      message: 'Your 14-day free trial has started!',
      trialEndsAt: trialEndsAt.toISOString(),
      redirectUrl: '/dashboard',
    });
  } catch (error: any) {
    console.error('Start Trial Error:', error);
    res.status(500).json({ error: error.message || 'Failed to start trial' });
  }
};

/**
 * Start trial with card validation (for immediate subscription after trial)
 */
export const startTrialWithCard = async (req: Request, res: Response) => {
  try {
    const { planCode } = req.body;
    const user = (req as any).user;

    if (!user || !user.email) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user is already active
    if (user.subscription?.status === 'active') {
      return res.status(400).json({ error: 'User already has an active subscription' });
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
    console.error('Start Trial With Card Error:', error);
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

    // Update User to active status (Upgrade complete)
    await User.findByIdAndUpdate(user.id, {
      'subscription.status': 'active',
      'subscription.plan': 'premium',
      // We don't set trialEndsAt because the trial is over/converted
    });

    res.status(200).json({
      message: 'Subscription activated successfully',
      subscription: subscriptionData.data,
    });
  } catch (error: any) {
    console.error('Verify Trial Error:', error);
    res.status(500).json({ error: error.message || 'Failed to verify trial' });
  }
};

/**
 * Get available pricing plans
 * Public endpoint - no authentication required
 */
export const getPricing = async (_req: Request, res: Response) => {
  try {
    const plans = [
      {
        id: 'individual_monthly',
        name: 'Individual Monthly',
        code: PAYSTACK_PLANS.INDIVIDUAL_MONTHLY.code,
        amount: PAYSTACK_PLANS.INDIVIDUAL_MONTHLY.amount,
        currency: 'NGN',
        interval: 'monthly',
        features: [
          'Access to all premium subjects',
          'Unlimited lesson access',
          'Progress tracking',
          'Ad-free experience',
        ],
      },
      {
        id: 'individual_annual',
        name: 'Individual Annual',
        code: PAYSTACK_PLANS.INDIVIDUAL_ANNUAL.code,
        amount: PAYSTACK_PLANS.INDIVIDUAL_ANNUAL.amount,
        currency: 'NGN',
        interval: 'annual',
        savings: '₦25,000 per year',
        features: [
          'Access to all premium subjects',
          'Unlimited lesson access',
          'Progress tracking',
          'Ad-free experience',
          'Priority support',
        ],
      },
      {
        id: 'family_annual',
        name: 'Family Annual',
        code: PAYSTACK_PLANS.FAMILY_ANNUAL.code,
        amount: PAYSTACK_PLANS.FAMILY_ANNUAL.amount,
        currency: 'NGN',
        interval: 'annual',
        maxUsers: 5,
        features: [
          'Up to 5 family members',
          'Access to all premium subjects',
          'Unlimited lesson access',
          'Progress tracking for each member',
          'Ad-free experience',
          'Priority support',
        ],
      },
    ];

    successResponse(res, plans, 'Pricing plans retrieved successfully', 200);
  } catch (error: any) {
    console.error('Get Pricing Error:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve pricing' });
  }
};
