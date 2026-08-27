// Paid subjects - these require a subscription
export const PAID_SUBJECTS = ['german', 'french', 'latin', 'spanish'];

// Blocked subjects - these will be filtered out entirely from all endpoints
// Currently allowing english, maths, and science
export const BLOCKED_SUBJECTS = [
  'geography',
  'history',
  'music',
  'physical-education',
  'pe',
  'design-technology',
  'religious-education',
  'art',
  'french',
  'german',
  'spanish',
  'latin',
];

// Allowed subjects per key stage - english, maths, science, and computing
export const ALLOWED_SUBJECTS: Record<string, string[]> = {
  ks1: ['english', 'maths', 'science', 'computing'],
  ks2: ['english', 'maths', 'science', 'computing'],
  ks3: ['english', 'maths', 'science', 'computing'],
  ks4: ['english', 'maths', 'science', 'computing'],
};
