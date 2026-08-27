import axios from 'axios';
import config from '../config';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const getHeaders = () => ({
  Authorization: `Bearer ${config.paystack.secretKey}`,
  'Content-Type': 'application/json',
});

export const initializeCardValidation = async (email: string, planCode: string) => {
  const response = await axios.post(
    `${PAYSTACK_BASE_URL}/transaction/initialize`,
    {
      email,
      amount: 5000, // NGN 50 to validate card
      metadata: {
        planCode,
      },
    },
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

/**
 * Initialize a direct payment transaction (skip trial, pay immediately)
 */
export const initializePayment = async (
  email: string,
  planCode: string | null,
  amount: number,
  callbackUrl: string,
  tierId?: string | null,
) => {
  const payload: {
    email: string;
    amount: number;
    callback_url: string;
    metadata: { planCode: string | null; paymentType: 'direct' | 'one-time'; tierId?: string };
    plan?: string;
  } = {
    email,
    amount, // Amount in kobo
    callback_url: callbackUrl,
    metadata: {
      planCode,
      paymentType: planCode ? 'direct' : 'one-time',
      // Forward tierId so verifyPayment can update LicenseBatch.maxUsers correctly
      ...(tierId && { tierId }),
    },
  };

  if (planCode) {
    payload.plan = planCode;
  }

  const response = await axios.post(`${PAYSTACK_BASE_URL}/transaction/initialize`, payload, {
    headers: getHeaders(),
  });

  return response.data;
};

/**
 * Disable (cancel) an existing Paystack subscription so the customer is not
 * billed twice when switching from one plan to another.
 *
 * Paystack requires both the subscription code AND the email_token that was
 * sent to the customer. We use the /subscription/:code endpoint to fetch the
 * token first, then call disable.
 *
 * Errors are swallowed with a warning so that a failed cancel never blocks
 * a new payment from proceeding — worst case the customer contacts support.
 */
export const cancelSubscription = async (subscriptionCode: string): Promise<void> => {
  try {
    // 1. Fetch subscription details to get the email_token
    const detailsRes = await axios.get(`${PAYSTACK_BASE_URL}/subscription/${subscriptionCode}`, {
      headers: getHeaders(),
    });

    const emailToken: string | undefined = detailsRes.data?.data?.email_token;

    if (!emailToken) {
      console.warn(
        `[Paystack] No email_token found for subscription ${subscriptionCode} — skipping cancel`,
      );
      return;
    }

    // 2. Disable the subscription
    await axios.post(
      `${PAYSTACK_BASE_URL}/subscription/disable`,
      { code: subscriptionCode, token: emailToken },
      { headers: getHeaders() },
    );

    console.log(`[Paystack] Subscription ${subscriptionCode} disabled successfully`);
  } catch (error) {
    // Non-fatal — log and continue so the new payment can still proceed
    const detail = axios.isAxiosError(error) ? error.response?.data : undefined;
    console.warn(
      `[Paystack] Failed to cancel subscription ${subscriptionCode}:`,
      detail || (error instanceof Error ? error.message : error),
    );
  }
};

export const verifyAndCreateTrial = async (reference: string) => {
  // 1. Verify Transaction
  const verifyResponse = await axios.get(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
    headers: getHeaders(),
  });

  const transactionData = verifyResponse.data.data;

  if (transactionData.status !== 'success') {
    throw new Error('Transaction verification failed');
  }

  const authorizationCode = transactionData.authorization.authorization_code;
  const planCode = transactionData.metadata?.planCode;

  if (!authorizationCode || !planCode) {
    throw new Error('Missing authorization code or plan code');
  }

  // 2. Start Subscription Immediately
  const startDate = new Date(); // Start now

  // 3. Create Subscription
  const subscriptionResponse = await axios.post(
    `${PAYSTACK_BASE_URL}/subscription`,
    {
      customer: transactionData.customer.email,
      plan: planCode,
      authorization: authorizationCode,
      start_date: startDate.toISOString(),
    },
    {
      headers: getHeaders(),
    },
  );

  return subscriptionResponse.data;
};

/**
 * Verify a payment transaction (for direct payments where subscription is auto-created)
 */
export const verifyPayment = async (reference: string) => {
  const verifyResponse = await axios.get(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
    headers: getHeaders(),
  });

  const transactionData = verifyResponse.data.data;

  if (transactionData.status !== 'success') {
    throw new Error('Transaction verification failed');
  }

  return {
    success: true,
    data: transactionData,
    planCode: transactionData.metadata?.planCode,
    paymentType: transactionData.metadata?.paymentType,
    email: transactionData.customer?.email,
  };
};
