import { Response } from 'express';
import * as paystackService from '../services/paystackService';
import User from '../models/User';
import LicenseBatch from '../models/LicenseBatch';
import { PAYSTACK_PLANS, getActivePlanCodes, PaystackPlan } from '../config/paystack';
import { successResponse } from '../middleware/response';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import config from '../config';

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

/**
 * Whether a client-supplied Paystack callback URL may be used.
 *
 * Accepts the mobile app's own URL scheme and any path on the configured
 * frontend origin. Everything else is rejected so a caller cannot point a
 * payment redirect at a host we do not control.
 */
const isAllowedCallbackUrl = (candidate: unknown): candidate is string => {
  if (typeof candidate !== 'string' || !candidate) return false;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return false;
  }

  if (parsed.protocol === `${config.mobileAppScheme}:`) return true;

  try {
    return parsed.origin === new URL(config.frontendUrl).origin;
  } catch {
    return false;
  }
};

/**
 * Start a free trial (configurable days, default 7)
 * No credit card required - user gets immediate access
 */
export const startTrial = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if payments are enabled
    if (!config.payment.enabled) {
      return res.status(503).json({ error: 'Payment system is currently disabled' });
    }

    // Check if free trial is enabled
    if (!config.payment.enableFreeTrial) {
      return res
        .status(403)
        .json({ error: 'Free trial is currently disabled. Please proceed to payment.' });
    }

    const { planCode } = req.body;
    const { user } = req;

    if (!user || !user.email) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user already has an active PAID subscription
    if (user.subscription?.status === 'active' && user.subscription?.plan !== 'free') {
      return res.status(400).json({ error: 'You already have an active paid subscription' });
    }

    // Check if user is already trialing
    if (user.subscription?.status === 'trialing') {
      const { trialEndsAt } = user.subscription;
      if (trialEndsAt && new Date(trialEndsAt) > new Date()) {
        return res.status(400).json({
          error: 'You already have an active trial',
          trialEndsAt,
        });
      }
    }

    // Validate planCode (optional - store for when they convert)
    if (planCode) {
      const isValidPlan = Object.values(PAYSTACK_PLANS).some((p) => p.code === planCode);
      if (!isValidPlan) {
        return res.status(400).json({ error: 'Invalid plan code' });
      }

      // Daily and Weekly plans do not include a free trial — must pay directly
      const NO_TRIAL_PLAN_KEYS: (keyof typeof PAYSTACK_PLANS)[] = [
        'INDIVIDUAL_DAILY',
        'INDIVIDUAL_WEEKLY',
      ];
      const isNoTrialPlan = NO_TRIAL_PLAN_KEYS.some((key) => PAYSTACK_PLANS[key].code === planCode);
      if (isNoTrialPlan) {
        return res.status(400).json({
          error: 'Daily and Weekly plans do not include a free trial. Please proceed to payment.',
        });
      }
    }

    // Find plan from code to get its descriptive name
    let planName = 'premium';
    const planEntry = Object.entries(PAYSTACK_PLANS).find(([, p]) => p.code === planCode);
    if (planEntry) {
      planName = planEntry[0].toLowerCase(); // e.g., 'school_small'
    }

    // Calculate trial end date (configurable, default 1 month for schools as requested)
    const trialDays = planName.includes('school') ? 30 : config.payment.trialDays;
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    // Update user with trial subscription
    await User.findByIdAndUpdate(user.id, {
      'subscription.status': 'trialing',
      'subscription.plan': planName,
      'subscription.trialEndsAt': trialEndsAt,
    });

    return res.status(200).json({
      message: `Your ${trialDays}-day free trial has started!`,
      trialEndsAt: trialEndsAt.toISOString(),
      redirectUrl: '/dashboard',
    });
  } catch (error) {
    console.error('Start Trial Error:', error);
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to start trial') });
  }
};

/**
 * Start trial with card validation (for immediate subscription after trial)
 */
export const startTrialWithCard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { planCode } = req.body;
    const { user } = req;

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

    return res.status(200).json({
      message: 'Authorization URL created',
      authorizationUrl: initializationData.data.authorization_url,
      reference: initializationData.data.reference,
    });
  } catch (error) {
    console.error('Start Trial With Card Error:', error);
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to start trial') });
  }
};

export const verifyTrial = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reference } = req.body;
    const { user } = req;

    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const subscriptionData = await paystackService.verifyAndCreateTrial(reference);
    const planCode = subscriptionData.data.plan;

    // Find plan name
    let planName = 'premium';
    const planEntry = Object.entries(PAYSTACK_PLANS).find(([, p]) => p.code === planCode);
    if (planEntry) {
      planName = planEntry[0].toLowerCase();
    }

    // Update User to active status (Upgrade complete)
    await User.findByIdAndUpdate(user.id, {
      'subscription.status': 'active',
      'subscription.plan': planName,
      // Clear trial
      'subscription.trialEndsAt': null,
    });

    return res.status(200).json({
      message: 'Subscription activated successfully',
      subscription: subscriptionData.data,
    });
  } catch (error) {
    console.error('Verify Trial Error:', error);
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to verify trial') });
  }
};

/**
 * Verify a direct payment.
 * - One-time term purchases: extends the school's LicenseBatch expiryDate by 12 weeks.
 * - Recurring plan purchases: activates the User's subscription.
 */
export const verifyPayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reference } = req.body;
    const { user } = req;

    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!reference) {
      return res.status(400).json({ error: 'Payment reference is required' });
    }

    const verificationResult = await paystackService.verifyPayment(reference);

    if (!verificationResult.success) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    const paymentType = verificationResult.data.metadata?.paymentType;

    if (paymentType === 'one-time') {
      // --- School Term (one-time) flow ---
      // Find the school's LicenseBatch via the admin's schoolCode or licenseKey.
      // req.user (from the JWT) only carries {id, role, name, email, subscription} -
      // schoolCode/licenseKey live on the DB user document, so fetch it fresh.
      const freshUser = await User.findById(user.id).lean();
      const schoolCode = freshUser?.schoolCode || freshUser?.licenseKey;
      if (!schoolCode) {
        return res
          .status(400)
          .json({ error: 'No school code or license key associated with this account' });
      }

      const batch = await LicenseBatch.findOne({ licenseKey: schoolCode });
      if (!batch) {
        return res.status(404).json({ error: 'License batch not found for this school' });
      }

      // Extend from today (or from current expiry if still active in the future)
      const TERM_WEEKS = 12;
      const baseDate = batch.expiryDate > new Date() ? batch.expiryDate : new Date();
      const newExpiry = new Date(baseDate);
      newExpiry.setDate(newExpiry.getDate() + TERM_WEEKS * 7);

      // Resolve the purchased tier's student limit so maxUsers is updated correctly.
      // verificationResult.data.metadata.tierId is set when initializing a term payment.
      const tierId: string | undefined = verificationResult.data.metadata?.tierId;
      const tierKey = tierId?.toUpperCase() as keyof typeof PAYSTACK_PLANS | undefined;
      const purchasedTier = tierKey ? (PAYSTACK_PLANS[tierKey] as PaystackPlan) : null;
      const newMaxUsers: number | undefined = purchasedTier?.studentLimit;

      await LicenseBatch.findByIdAndUpdate(batch._id, {
        expiryDate: newExpiry,
        isActive: true,
        // Only update maxUsers if the purchased tier has a defined student limit
        ...(newMaxUsers && { maxUsers: newMaxUsers }),
      });

      return res.status(200).json({
        message: `School term access extended by ${TERM_WEEKS} weeks. Access valid until ${newExpiry.toDateString()}.`,
        success: true,
        expiryDate: newExpiry.toISOString(),
        weeksGranted: TERM_WEEKS,
      });
    }
    // --- Recurring subscription (plan) flow ---
    const planCode = verificationResult.data.plan;
    let planName = 'premium';
    const planEntry = Object.entries(PAYSTACK_PLANS).find(([, p]) => p.code === planCode);
    if (planEntry) {
      planName = planEntry[0].toLowerCase();
    }

    await User.findByIdAndUpdate(user.id, {
      'subscription.status': 'active',
      'subscription.plan': planName,
      'subscription.trialEndsAt': null,
    });

    return res.status(200).json({
      message: 'Payment verified successfully! Your subscription is now active.',
      success: true,
    });
  } catch (error) {
    console.error('Verify Payment Error:', error);
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to verify payment') });
  }
};

/**
 * Initialize direct payment (skip trial, pay with card immediately)
 * Handles both recurring plans (school year / individual) and one-time term purchases.
 */
export const initializePayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if payments are enabled
    if (!config.payment.enabled) {
      return res.status(503).json({ error: 'Payment system is currently disabled' });
    }

    // Check if direct payment is enabled
    if (!config.payment.enableDirectPayment) {
      return res
        .status(403)
        .json({ error: 'Direct payment is currently disabled. Please start with a free trial.' });
    }

    // Accept either a Paystack planCode (for recurring) or a tierId (for one-time term)
    const { planCode, tierId, callbackUrl: requestedCallbackUrl } = req.body;
    const { user } = req;

    if (!user || !user.email) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    let planAmount: number | null = null;
    let resolvedPlanCode: string | null = null;

    if (tierId) {
      // One-time term purchase — look up by tier ID key (e.g. 'SCHOOL_TIER1_TERM')
      const tierKey = tierId.toUpperCase() as keyof typeof PAYSTACK_PLANS;
      const tier = PAYSTACK_PLANS[tierKey];

      if (!tier || tier.type !== 'one-time') {
        return res.status(400).json({ error: 'Invalid tier ID for one-time purchase' });
      }

      planAmount = tier.amount;
      resolvedPlanCode = null; // No Paystack plan for term payments
    } else if (planCode) {
      // Recurring subscription — find by plan code
      const matchedPlan = Object.values(PAYSTACK_PLANS).find((plan) => plan.code === planCode);

      if (!matchedPlan) {
        return res.status(400).json({ error: 'Invalid plan code' });
      }

      planAmount = matchedPlan.amount;
      resolvedPlanCode = planCode;
    } else {
      return res.status(400).json({ error: 'Either planCode or tierId is required' });
    }

    // The web app returns to its own /payment/callback page. The mobile app
    // cannot — an in-app browser has to be handed back to the app's own URL
    // scheme — so clients may request a callback, validated against an
    // allow-list. Anything unrecognised falls back to the web callback rather
    // than letting a caller redirect a payment anywhere it likes.
    const defaultCallbackUrl = `${config.frontendUrl}/payment/callback`;
    const callbackUrl = isAllowedCallbackUrl(requestedCallbackUrl)
      ? requestedCallbackUrl
      : defaultCallbackUrl;

    // ── Cancel existing Paystack subscription before creating a new one ─────────
    // This prevents double billing when a user switches between plans.
    // We fetch a fresh copy of the user from the DB (req.user may be stale).
    if (resolvedPlanCode) {
      const freshUser = await User.findById(user.id).lean();
      const existingSubCode = freshUser?.subscription?.paystackSubscriptionCode;
      if (existingSubCode) {
        console.log(
          `[Payment] Cancelling old subscription ${existingSubCode} before switching plans`,
        );
        await paystackService.cancelSubscription(existingSubCode);
        // Clear the stored code immediately so we don't double-cancel
        await User.findByIdAndUpdate(user.id, {
          'subscription.paystackSubscriptionCode': null,
        });
      }
    }

    const initializationData = await paystackService.initializePayment(
      user.email,
      resolvedPlanCode,
      planAmount!,
      callbackUrl,
      tierId ?? null, // Forward tierId so verifyPayment can update LicenseBatch.maxUsers
    );

    return res.status(200).json({
      message: 'Payment initialized',
      authorization_url: initializationData.data.authorization_url,
      reference: initializationData.data.reference,
    });
  } catch (error) {
    console.error(
      'Initialize Payment Error:',
      (error as { response?: { data?: unknown } })?.response?.data || error,
    );
    // Surface the Paystack error message directly (e.g. "Plan not found")
    const paystackMessage = (error as { response?: { data?: { message?: string } } })?.response
      ?.data?.message;
    const friendlyMessage = paystackMessage
      ? `Payment provider error: ${paystackMessage}`
      : getErrorMessage(error, 'Failed to initialize payment');
    return res.status(500).json({ error: friendlyMessage });
  }
};

/**
 * Get available pricing plans
 * Public endpoint - no authentication required
 */
export const getPricing = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    // Calculate annual savings: (monthly * 12) - annual
    const monthlyCost = PAYSTACK_PLANS.INDIVIDUAL_MONTHLY.amount;
    const annualCost = PAYSTACK_PLANS.INDIVIDUAL_ANNUAL.amount;
    const annualSavings = monthlyCost * 12 - annualCost;
    const savingsFormatted = `₦${(annualSavings / 100).toLocaleString()} per year`;

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
        savings: savingsFormatted,
        features: [
          'Access to all premium subjects',
          'Unlimited lesson access',
          'Progress tracking',
          'Ad-free experience',
          'Priority support',
        ],
      },
    ];

    // Include payment configuration status for frontend
    const response = {
      plans,
      config: {
        paymentEnabled: config.payment.enabled,
        freeTrialEnabled: config.payment.enableFreeTrial,
        directPaymentEnabled: config.payment.enableDirectPayment,
        trialDays: config.payment.trialDays,
        paystackMode: config.paystack.mode,
        paystackPublicKey: config.paystack.publicKey,
      },
    };

    successResponse(res, response, 'Pricing plans retrieved successfully', 200);
  } catch (error) {
    console.error('Get Pricing Error:', error);
    res.status(500).json({ error: getErrorMessage(error, 'Failed to retrieve pricing') });
  }
};

/**
 * Get active plan codes for modals
 * Public endpoint - returns plan codes based on current Paystack mode (test/live)
 */
export const getPlans = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const planData = getActivePlanCodes();
    res.status(200).json(planData);
  } catch (error) {
    console.error('Get Plans Error:', error);
    res.status(500).json({ error: getErrorMessage(error, 'Failed to retrieve plans') });
  }
};

/**
 * Cancel the authenticated user's active Paystack subscription.
 * - Calls Paystack's disable API if a subscription code is stored.
 * - Immediately downgrades the user to the free tier so premium content is
 *   blocked right away, without waiting for the webhook.
 * POST /api/v1/payment/cancel
 */
export const cancelUserSubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;

    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Fetch a fresh copy — req.user may be stale/cached
    const freshUser = await User.findById(user.id);
    if (!freshUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (freshUser.subscription?.status !== 'active') {
      return res.status(400).json({ error: 'No active subscription to cancel' });
    }

    const subCode = freshUser.subscription?.paystackSubscriptionCode;

    if (subCode) {
      // Attempt Paystack cancellation — non-fatal if it fails
      // (Paystack will also fire subscription.disable webhook to confirm)
      await paystackService.cancelSubscription(subCode);
    } else {
      console.warn(
        `[Cancel] User ${freshUser.email} has no paystackSubscriptionCode — downgrading locally only`,
      );
    }

    // Immediately downgrade to free tier in the DB regardless of Paystack result
    await User.findByIdAndUpdate(freshUser._id, {
      'subscription.status': 'cancelled',
      'subscription.plan': 'free',
      'subscription.paystackSubscriptionCode': null,
      'subscription.trialEndsAt': null,
    });

    return res.status(200).json({
      success: true,
      message: 'Subscription cancelled. Your account has been downgraded to the free tier.',
    });
  } catch (error) {
    console.error('Cancel Subscription Error:', error);
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to cancel subscription') });
  }
};
