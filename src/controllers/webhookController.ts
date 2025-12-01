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
        // Update to active and extend expiry
        // Usually we get 'authorization' and 'plan' in data
        // For simplicity, we just set to active and update expiry if provided or just set to active
        // If it's a subscription payment, we might want to check existing subscription
        await User.findByIdAndUpdate(user._id, {
          'subscription.status': 'active',
          'subscription.plan': 'premium',
          // Optionally set expiresAt based on plan interval if we parsed it,
          // but Paystack handles the recurring billing.
          // We can set it to a future date just in case.
        });
        break;

      case 'subscription.disable':
        await User.findByIdAndUpdate(user._id, {
          'subscription.status': 'cancelled',
        });
        break;

      case 'invoice.payment_failed':
        await User.findByIdAndUpdate(user._id, {
          'subscription.status': 'past_due',
        });
        break;

      default:
        // Handle other events or ignore
        break;
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook Error:', error);
    res.sendStatus(500);
  }
};
