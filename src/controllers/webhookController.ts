import { Request, Response } from 'express';
import crypto from 'crypto';
import config from '../config';
import User from '../models/User';

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
      // User not found, maybe log it
      console.warn(`Webhook received for unknown user: ${email}`);
      return res.status(200).send('User not found, but webhook received');
    }

    switch (event.event) {
      case 'charge.success':
        // Successful payment - activate subscription
        console.log(`[Webhook] charge.success for ${email}`);
        await User.findByIdAndUpdate(user._id, {
          'subscription.status': 'active',
          'subscription.plan': 'premium',
          'subscription.trialEndsAt': null, // Clear trial if was trialing
        });
        break;

      case 'subscription.create':
        // Subscription created successfully
        console.log(`[Webhook] subscription.create for ${email}`);
        await User.findByIdAndUpdate(user._id, {
          'subscription.status': 'active',
          'subscription.plan': 'premium',
        });
        break;

      case 'subscription.disable':
      case 'subscription.not_renew':
        // Subscription cancelled or won't renew
        console.log(`[Webhook] ${event.event} for ${email}`);
        await User.findByIdAndUpdate(user._id, {
          'subscription.status': 'cancelled',
        });
        break;

      case 'invoice.payment_failed':
      case 'charge.failed':
        // Payment failed - set to past_due so user is blocked
        console.log(`[Webhook] ${event.event} for ${email}`);
        await User.findByIdAndUpdate(user._id, {
          'subscription.status': 'past_due',
        });
        break;

      case 'invoice.update':
      case 'invoice.create':
        // Informational - just log
        console.log(`[Webhook] ${event.event} for ${email}`);
        break;

      default:
        // Log unknown events for debugging
        console.log(`[Webhook] Unhandled event: ${event.event} for ${email}`);
        break;
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook Error:', error);
    res.sendStatus(500);
  }
};
