import { Request, Response } from 'express';
import crypto from 'crypto';
import config from '../config';
import User from '../models/User';
import { PAYSTACK_PLANS } from '../config/paystack';

/**
 * Resolve a Paystack plan code to a human-readable plan key.
 * Falls back to 'premium' if no match found (safe default).
 */
const resolvePlanName = (planCode: string | undefined): string => {
  if (!planCode) return 'premium';
  const entry = Object.entries(PAYSTACK_PLANS).find(([, p]) => p.code === planCode);
  // e.g. 'INDIVIDUAL_DAILY' → 'individual_daily'
  return entry ? entry[0].toLowerCase() : 'premium';
};

export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const hash = crypto
      .createHmac('sha512', config.paystack.secretKey)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).send('Invalid signature');
    }

    const event = req.body;
    const { email } = event.data.customer;

    if (!email) {
      return res.status(400).send('No customer email in event');
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.warn(`Webhook received for unknown user: ${email}`);
      return res.status(200).send('User not found, but webhook received');
    }

    switch (event.event) {
      case 'charge.success': {
        // Resolve real plan name from the plan code on the transaction
        const planCode: string | undefined = event.data.plan?.plan_code;
        const planName = resolvePlanName(planCode);
        console.log(`[Webhook] charge.success for ${email} — plan: ${planName}`);
        await User.findByIdAndUpdate(user._id, {
          'subscription.status': 'active',
          'subscription.plan': planName,
          'subscription.trialEndsAt': null,
        });
        break;
      }

      case 'subscription.create': {
        // Resolve real plan name and store the Paystack subscription code
        const planCode: string | undefined = event.data.plan?.plan_code;
        const subscriptionCode: string | undefined = event.data.subscription_code;
        const planName = resolvePlanName(planCode);
        console.log(
          `[Webhook] subscription.create for ${email} — plan: ${planName}, code: ${subscriptionCode}`,
        );
        await User.findByIdAndUpdate(user._id, {
          'subscription.status': 'active',
          'subscription.plan': planName,
          'subscription.trialEndsAt': null,
          // Store the subscription code so we can cancel it if the user switches plans
          ...(subscriptionCode && {
            'subscription.paystackSubscriptionCode': subscriptionCode,
          }),
        });
        break;
      }

      case 'subscription.disable':
      case 'subscription.not_renew':
        console.log(`[Webhook] ${event.event} for ${email}`);
        await User.findByIdAndUpdate(user._id, {
          'subscription.status': 'cancelled',
          'subscription.paystackSubscriptionCode': null,
        });
        break;

      case 'invoice.payment_failed':
      case 'charge.failed':
        console.log(`[Webhook] ${event.event} for ${email}`);
        await User.findByIdAndUpdate(user._id, {
          'subscription.status': 'past_due',
        });
        break;

      case 'invoice.update':
      case 'invoice.create':
        console.log(`[Webhook] ${event.event} for ${email}`);
        break;

      default:
        console.log(`[Webhook] Unhandled event: ${event.event} for ${email}`);
        break;
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error('Webhook Error:', error);
    return res.sendStatus(500);
  }
};
