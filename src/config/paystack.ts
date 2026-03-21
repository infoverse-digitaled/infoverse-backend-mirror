import config from './index';

// Plan codes for different environments
const PLAN_CODES = {
  test: {
    INDIVIDUAL_MONTHLY: 'PLN_ycwo3qwzubzlv3v',
    INDIVIDUAL_ANNUAL: 'PLN_o1rf7r0jl507aoq',
    FAMILY_ANNUAL: '', // Add test family plan code if needed
  },
  live: {
    INDIVIDUAL_MONTHLY: 'PLN_vnfkw3ejctr7fe4',
    INDIVIDUAL_ANNUAL: 'PLN_t56h44wx8f2vcw7',
    FAMILY_ANNUAL: 'PLN_8et2pw5d7mfg3j1',
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
  FAMILY_ANNUAL: {
    code: activePlanCodes.FAMILY_ANNUAL,
    amount: 11500000, // ₦115,000
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
