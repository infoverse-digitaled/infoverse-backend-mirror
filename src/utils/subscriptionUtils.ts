/**
 * Subscription Utility Functions
 * Provides unified logic for checking user subscription status across the application.
 */

export interface SubscriptionInfo {
  plan: 'free' | 'premium';
  status: 'free' | 'active' | 'inactive' | 'cancelled' | 'trialing' | 'past_due';
  expiresAt?: Date;
  trialEndsAt?: Date;
}

export interface UserWithSubscription {
  id: string;
  role: string;
  subscription?: SubscriptionInfo;
}

/**
 * Determines if a user should be treated as a "free" user (with limited access).
 *
 * A user has PREMIUM access if:
 * - subscription.status === 'active' (paid and current)
 * - subscription.status === 'trialing' AND trialEndsAt > now (trial still valid)
 *
 * A user has FREE/LIMITED access if:
 * - No user object
 * - No subscription object
 * - subscription.status === 'free'
 * - subscription.status === 'trialing' AND trialEndsAt <= now (trial expired)
 * - subscription.status === 'past_due' (payment failed)
 * - subscription.status === 'cancelled'
 * - subscription.status === 'inactive'
 *
 * @param user - User object with subscription info
 * @returns true if user should be treated as free (limited access), false for premium access
 */
export const isFreeUser = (user?: UserWithSubscription | null): boolean => {
  // No user or no subscription = free user
  if (!user) return true;
  if (!user.subscription) return true;

  const { status, trialEndsAt } = user.subscription;

  // Active paid subscription = premium access
  if (status === 'active') {
    return false;
  }

  // Trialing users need trial validity check
  if (status === 'trialing') {
    if (trialEndsAt && new Date(trialEndsAt) > new Date()) {
      return false; // Trial still valid = premium access
    }
    return true; // Trial expired = free user
  }

  // All other statuses (free, past_due, cancelled, inactive) = free user
  return true;
};

/**
 * Checks if a user's trial has expired and should be downgraded.
 *
 * @param user - User object with subscription info
 * @returns true if trial has expired, false otherwise
 */
export const isTrialExpired = (user?: UserWithSubscription | null): boolean => {
  if (!user?.subscription) return false;

  const { status, trialEndsAt } = user.subscription;

  if (status !== 'trialing') return false;
  if (!trialEndsAt) return false;

  return new Date(trialEndsAt) <= new Date();
};

/**
 * Returns the user's effective subscription tier for display purposes.
 *
 * @param user - User object with subscription info
 * @returns 'premium' or 'free'
 */
export const getSubscriptionTier = (user?: UserWithSubscription | null): 'premium' | 'free' => {
  return isFreeUser(user) ? 'free' : 'premium';
};
