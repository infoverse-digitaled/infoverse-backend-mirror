import config from './index';

// Plan codes for different environments
const PLAN_CODES = {
  test: {
    INDIVIDUAL_DAILY: 'PLN_2bfdgowxp4iifmr',
    INDIVIDUAL_WEEKLY: 'PLN_bhdu9e8b9ugrmg8',
    INDIVIDUAL_MONTHLY: 'PLN_0xoqk4fd4ot3juu',
    INDIVIDUAL_ANNUAL: 'PLN_cyhq1vhzf56cyfb',
    // School Tiers - Year Only (Plans)
    SCHOOL_TIER1_YEAR: 'PLN_school_tier1_year',
    SCHOOL_TIER2_YEAR: 'PLN_school_tier2_year',
    SCHOOL_TIER3_YEAR: 'PLN_school_tier3_year',
    SCHOOL_TIER4_YEAR: 'PLN_school_tier4_year',
  },
  live: {
    INDIVIDUAL_DAILY: 'PLN_fq49l19jvokxoy1',
    INDIVIDUAL_WEEKLY: 'PLN_81o2g4ew9okwjms',
    INDIVIDUAL_MONTHLY: 'PLN_sgry7evrd03iw15',
    INDIVIDUAL_ANNUAL: 'PLN_alwct8bj4ybmjqf',
    // School Tiers - Year Only (Plans)
    SCHOOL_TIER1_YEAR: 'PLN_mvzn7tlh3xdeao9',
    SCHOOL_TIER2_YEAR: 'PLN_2434mpkupmiabq5',
    SCHOOL_TIER3_YEAR: 'PLN_oop6ah9gyherj25',
    SCHOOL_TIER4_YEAR: 'PLN_amg0wbqdii16y1a',
  },
};

// Get the correct plan codes based on current mode
const currentMode = config.paystack.mode;
const activePlanCodes = PLAN_CODES[currentMode as 'test' | 'live'];

export interface PaystackPlan {
  code: string | undefined;
  amount: number;
  type: 'plan' | 'one-time';
  studentLimit?: number;
  interval?: string;
}

export const PAYSTACK_PLANS = {
  INDIVIDUAL_DAILY: {
    code: activePlanCodes.INDIVIDUAL_DAILY,
    amount: 10000,
    type: 'plan',
  },
  INDIVIDUAL_WEEKLY: {
    code: activePlanCodes.INDIVIDUAL_WEEKLY,
    amount: 60000,
    type: 'plan',
  },
  INDIVIDUAL_MONTHLY: {
    code: activePlanCodes.INDIVIDUAL_MONTHLY,
    amount: 200000,
    type: 'plan',
  },
  INDIVIDUAL_ANNUAL: {
    code: activePlanCodes.INDIVIDUAL_ANNUAL,
    amount: 2000000,
    type: 'plan',
  },
  // School Tiers - Term (One-time, no Paystack plan code)
  SCHOOL_TIER1_TERM: {
    code: undefined,
    amount: 25000000,
    studentLimit: 100,
    type: 'one-time',
    interval: '12 weeks',
  },
  SCHOOL_TIER2_TERM: {
    code: undefined,
    amount: 35000000,
    studentLimit: 250,
    type: 'one-time',
    interval: '12 weeks',
  },
  SCHOOL_TIER3_TERM: {
    code: undefined,
    amount: 45000000,
    studentLimit: 500,
    type: 'one-time',
    interval: '12 weeks',
  },
  SCHOOL_TIER4_TERM: {
    code: undefined,
    amount: 55000000,
    studentLimit: 1000,
    type: 'one-time',
    interval: '12 weeks',
  },
  // School Tiers - Year (Subscription Plan)
  SCHOOL_TIER1_YEAR: {
    code: activePlanCodes.SCHOOL_TIER1_YEAR,
    amount: 60000000,
    studentLimit: 100,
    type: 'plan',
  },
  SCHOOL_TIER2_YEAR: {
    code: activePlanCodes.SCHOOL_TIER2_YEAR,
    amount: 80000000,
    studentLimit: 250,
    type: 'plan',
  },
  SCHOOL_TIER3_YEAR: {
    code: activePlanCodes.SCHOOL_TIER3_YEAR,
    amount: 100000000,
    studentLimit: 500,
    type: 'plan',
  },
  SCHOOL_TIER4_YEAR: {
    code: activePlanCodes.SCHOOL_TIER4_YEAR,
    amount: 120000000,
    studentLimit: 1000,
    type: 'plan',
  },
} satisfies Record<string, PaystackPlan>;

// Export plan codes for API endpoint
export const getActivePlanCodes = () => ({
  mode: currentMode,
  plans: [
    {
      id: 'annual',
      name: 'Annual Plan',
      price: '₦20,000',
      description: 'Best value - save 30%',
      planCode: activePlanCodes.INDIVIDUAL_ANNUAL,
      recommended: true,
    },
    {
      id: 'monthly',
      name: 'Monthly Plan',
      price: '₦2,000',
      description: 'Billed monthly',
      planCode: activePlanCodes.INDIVIDUAL_MONTHLY,
    },
    {
      id: 'weekly',
      name: 'Weekly Plan',
      price: '₦600',
      description: 'Billed weekly',
      planCode: activePlanCodes.INDIVIDUAL_WEEKLY,
    },
    {
      id: 'daily',
      name: 'Daily Plan',
      price: '₦100',
      description: 'Billed daily',
      planCode: activePlanCodes.INDIVIDUAL_DAILY,
    },
    // Adding Term plans to summary
    {
      id: 'school_tier1_term',
      name: 'School Tier 1 (Term)',
      price: '₦250,000',
      planCode: null,
      description: '12 weeks access',
    },
    {
      id: 'school_tier2_term',
      name: 'School Tier 2 (Term)',
      price: '₦350,000',
      planCode: null,
      description: '12 weeks access',
    },
    {
      id: 'school_tier3_term',
      name: 'School Tier 3 (Term)',
      price: '₦450,000',
      planCode: null,
      description: '12 weeks access',
    },
    {
      id: 'school_tier4_term',
      name: 'School Tier 4 (Term)',
      price: '₦550,000',
      planCode: null,
      description: '12 weeks access',
    },
    // Adding Year plans to summary
    {
      id: 'school_tier1_year',
      name: 'School Tier 1 (Year)',
      price: '₦600,000',
      planCode: activePlanCodes.SCHOOL_TIER1_YEAR,
    },
    {
      id: 'school_tier2_year',
      name: 'School Tier 2 (Year)',
      price: '₦800,000',
      planCode: activePlanCodes.SCHOOL_TIER2_YEAR,
    },
    {
      id: 'school_tier3_year',
      name: 'School Tier 3 (Year)',
      price: '₦1,000,000',
      planCode: activePlanCodes.SCHOOL_TIER3_YEAR,
    },
    {
      id: 'school_tier4_year',
      name: 'School Tier 4 (Year)',
      price: '₦1,200,000',
      planCode: activePlanCodes.SCHOOL_TIER4_YEAR,
    },
  ],
});
