export const PAID_SUBJECTS = ['german', 'french', 'latin', 'spanish'];

// Blocked subjects - these will be filtered out entirely from all endpoints
// Used to temporarily remove problematic modules from the platform
export const BLOCKED_SUBJECTS = ['geography'];

// Allowed subjects per key stage - subjects outside this list will be filtered out
export const ALLOWED_SUBJECTS: Record<string, string[]> = {
  'ks1': [
    'english',
    'maths',
    'science',
    'computing',
    'art',
    'music',
    'pe',
    'design-technology',
  ],
  'ks2': [
    'english',
    'maths',
    'science',
    'computing',
    'art',
    'music',
    'pe',
    'design-technology',
    // 'geography', // Temporarily blocked
    'history',
    'religious-education',
  ],
  'ks3': [
    'english',
    'maths',
    'science',
    'computing',
    'art',
    'music',
    'pe',
    'design-technology',
    // 'geography', // Temporarily blocked
    'history',
    'religious-education',
    'french',
    'german',
    'spanish',
  ],
  'ks4': [
    'english',
    'maths',
    'science',
    'combined-science',
    'biology',
    'chemistry',
    'physics',
    'computing',
    'art',
    'music',
    'pe',
    'design-technology',
    // 'geography', // Temporarily blocked
    'history',
    'religious-education',
    'french',
    'german',
    'spanish',
    'latin',
  ],
};
