// Paid subjects - these require a subscription
export const PAID_SUBJECTS = ['german', 'french', 'latin', 'spanish'];

// Blocked subjects - these will be filtered out entirely from all endpoints
// Currently only allowing english and maths
export const BLOCKED_SUBJECTS = [
  'geography',
  'science',
  'history',
  'music',
  'physical-education',
  'pe',
  'design-technology',
  'religious-education',
  'combined-science',
  'biology',
  'chemistry',
  'physics',
  'art',
  'computing',
  'french',
  'german',
  'spanish',
  'latin',
];

// Allowed subjects per key stage - only english and maths for now
export const ALLOWED_SUBJECTS: Record<string, string[]> = {
  'ks1': ['english', 'maths'],
  'ks2': ['english', 'maths'],
  'ks3': ['english', 'maths'],
  'ks4': ['english', 'maths'],
};
