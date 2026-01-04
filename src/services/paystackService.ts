import axios from 'axios';
import config from '../config';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const getHeaders = () => ({
  Authorization: `Bearer ${config.paystack.secretKey}`,
  'Content-Type': 'application/json',
});

export const initializeCardValidation = async (email: string, planCode: string) => {
  try {
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
      }
    );

    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Initialize a direct payment transaction (skip trial, pay immediately)
 */
export const initializePayment = async (
  email: string,
  planCode: string,
  amount: number,
  callbackUrl: string
) => {
  try {
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email,
        amount, // Amount in kobo
        plan: planCode,
        callback_url: callbackUrl,
        metadata: {
          planCode,
          paymentType: 'direct', // Flag to distinguish from trial
        },
      },
      {
        headers: getHeaders(),
      }
    );

    return response.data;
  } catch (error) {
    throw error;
  }
};

export const verifyAndCreateTrial = async (reference: string) => {
  try {
    // 1. Verify Transaction
    const verifyResponse = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      {
        headers: getHeaders(),
      }
    );

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
      }
    );

    return subscriptionResponse.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Verify a payment transaction (for direct payments where subscription is auto-created)
 */
export const verifyPayment = async (reference: string) => {
  try {
    const verifyResponse = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      {
        headers: getHeaders(),
      }
    );

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
  } catch (error) {
    throw error;
  }
};
