import config from './index';

// Plan codes for different environments
const PLAN_CODES = {
  test: {
    INDIVIDUAL_MONTHLY: 'PLN_sgry7evrd03iw15',
    INDIVIDUAL_ANNUAL: 'PLN_alwct8bj4ybmjqf',
  },
  live: {
    INDIVIDUAL_MONTHLY: 'PLN_sgry7evrd03iw15',
    INDIVIDUAL_ANNUAL: 'PLN_alwct8bj4ybmjqf',
  },
};

// Get the correct plan codes based on current mode
const currentMode = config.paystack.mode;
const activePlanCodes = PLAN_CODES[currentMode];

export const PAYSTACK_PLANS = {
  INDIVIDUAL_MONTHLY: {
    code: activePlanCodes.INDIVIDUAL_MONTHLY,
    amount: 300000, // ₦3,000
  },
  INDIVIDUAL_ANNUAL: {
    code: activePlanCodes.INDIVIDUAL_ANNUAL,
    amount: 2500000, // ₦25,000
  },
};

// Export plan codes for API endpoint
export const getActivePlanCodes = () => ({
  mode: currentMode,
  plans: [
    {
      id: 'annual',
      name: 'Annual Plan',
      price: '₦25,000',
      description: 'Best value - save 30%',
      planCode: activePlanCodes.INDIVIDUAL_ANNUAL,
      recommended: true,
    },
    {
      id: 'monthly',
      name: 'Monthly Plan',
      price: '₦3,000',
      description: 'Billed monthly',
      planCode: activePlanCodes.INDIVIDUAL_MONTHLY,
    },
  ],
});
