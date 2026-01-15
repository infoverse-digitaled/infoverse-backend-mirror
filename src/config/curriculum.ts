// Paid subjects - these require a subscription
export const PAID_SUBJECTS = ['german', 'french', 'latin', 'spanish'];

// Blocked subjects - these will be filtered out entirely from all endpoints
// Currently allowing english and maths only
// Science blocked due to poor video coverage (only ~15% of lessons have video)
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
  'science', // Blocked: poor video coverage across all key stages
];

// Allowed subjects per key stage - english and maths only
export const ALLOWED_SUBJECTS: Record<string, string[]> = {
  'ks1': ['english', 'maths'],
  'ks2': ['english', 'maths'],
  'ks3': ['english', 'maths'],
  'ks4': ['english', 'maths'],
};
