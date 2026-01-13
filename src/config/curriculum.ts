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
  'computing',
  'french',
  'german',
  'spanish',
  'latin',
];

// Allowed subjects per key stage - english, maths, and science
export const ALLOWED_SUBJECTS: Record<string, string[]> = {
  'ks1': ['english', 'maths', 'science'],
  'ks2': ['english', 'maths', 'science'],
  'ks3': ['english', 'maths', 'science'],
  'ks4': ['english', 'maths', 'science'],
};
