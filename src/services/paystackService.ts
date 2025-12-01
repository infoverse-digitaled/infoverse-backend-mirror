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

    // 2. Calculate Start Date (7 days from now)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 7);

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
