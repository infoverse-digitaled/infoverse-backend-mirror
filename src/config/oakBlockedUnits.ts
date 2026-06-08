/**
 * Oak API - Known Blocked/Unavailable Unit Slugs
 *
 * This is a static blocklist of unit slugs that are known to be inaccessible
 * via the Oak API, either due to:
/**
 * Oak API - Known Blocked/Unavailable Unit Slugs
 *
 * This is a static blocklist of unit slugs that are known to be inaccessible
 * via the Oak API, either due to:
 *   - 400 Blocked:   The unit's content is copyright-restricted for API access
 *
 * These are filtered out of all curriculum lists so users never see them.
 * Last updated: 2026-03-04 (sourced from scan reports)
 */

export const BLOCKED_UNIT_SLUGS = new Set<string>([

  // --- COMPUTING PRIMARY ---
  'digital-writing', // Unit 2
  'creating-animations-in-programs', // Unit 3
  'building-sequences-in-programs', // Unit 6
  // --- ENGLISH PRIMARY: 400 Copyright Blocked ---
  'following-and-writing-instructions-to-make-a-sandwich-reading-and-writing',
  'the-three-little-pigs-reading-and-writing',
  'wild-reading-and-writing',
  'otherwise-narrative-writing',
  'the-planet-in-a-pickle-jar-book-club',
  'lucky-dip-narrative-writing',
  'humorous-poetry',
  'grandads-island-book-club',
  'leaf-book-club',
  'performance-poetry',
  'the-man-on-the-moon-narrative-writing',
  'the-pebble-in-my-pocket-reading',
  'the-journey-diary-writing',
  'marcy-and-the-riddle-of-the-sphinx-book-club',
  'rushing-rivers-reading',
  'poetry-inspired-by-big-and-small-objects-understanding-form',
  'curious-creatures-glowing-in-the-dark-reading',
  'walter-tulls-scrapbook-reading',
  'john-lyons-poetry-reading',
  'a-journey-through-greek-myths-reading',
  'arthur-and-the-golden-rope-reading',
  'whale-rider-narrative-writing',
  'poetry-inspired-by-weather',
  'laura-mucha-performance-poetry',
  'poet-focus-overheard-in-a-tower-block-by-jospeh-coelho',
  'crazy-about-cats-reading',
  'poetry-by-valerie-bloom',
  'the-highwayman-narrative-writing',
  'poetry-about-personal-experiences-reading',
  'the-listeners-reading',
  'shakespeares-macbeth-narrative-and-soliloquy-writing',
  'poetry-inspired-by-animals-reading',
  'shakespeares-romeo-and-juliet-diary-and-narrative-writing',
  'the-final-year-reading',
  'poetry-about-migration',
  'poetry-of-place',
  'no-country-and-frizzy-graphic-novels-exploring-identity-and-belonging',

  // --- ENGLISH SECONDARY (AQA/Edexcel/Eduqas): 400 Copyright Blocked ---
  // (many slugs are shared across exam boards - Set handles duplicates automatically)
  'step-into-the-unknown-fiction-reading-and-creative-writing',
  'poetry-about-place-and-home',
  'taking-a-stand',
  'womens-rights-across-the-ages-non-fiction-reading-and-writing',
  'a-world-at-war-short-stories',
  'small-island',
  'simon-armitage-writing-your-world',
  'modern-text-first-study-5139',   // AQA: Animal Farm
  'modern-text-first-study-5140',   // Edexcel: Animal Farm
  'modern-text-first-study-4896',   // AQA/Edexcel/Eduqas: An Inspector Calls
  'modern-text-first-study-198',    // AQA: Leave Taking
  'modern-text-first-study-1718',   // Eduqas: Leave Taking
  'poetry-anthology-first-study-201',   // AQA: Love & Relationships
  'poetry-anthology-first-study-155',   // AQA: Power & Conflict
  'poetry-anthology-first-study-199',   // AQA: World & Lives
  'poetry-anthology-first-study-203',   // Edexcel: Belonging
  'poetry-anthology-first-study-202',   // Edexcel: Conflict
  'poetry-anthology-first-study-5071',  // Eduqas: Anthology 2027
  'poetry-anthology-first-study-1482',  // Eduqas: Anthology 2026
  'non-fiction-crime-and-punishment',
  'non-fiction-changing-views',
  'modern-text-first-deep-dive-5141',  // AQA: Animal Farm
  'modern-text-first-deep-dive-5142',  // Edexcel: Animal Farm
  'modern-text-first-deep-dive-5033',  // AQA/Edexcel/Eduqas: An Inspector Calls
  'modern-text-first-deep-dive-188',   // AQA: Leave Taking
  'modern-text-first-deep-dive-1719',  // Eduqas: Leave Taking
  'poetry-anthology-continued-study-191',  // AQA: Love & Relationships
  'poetry-anthology-continued-study-172',  // AQA: Power & Conflict
  'poetry-anthology-continued-study-189',  // AQA: World & Lives
  'poetry-anthology-continued-study-193',  // Edexcel: Belonging
  'poetry-anthology-continued-study-192',  // Edexcel: Conflict
  'poetry-anthology-continued-study-5070', // Eduqas: Anthology 2027
  'poetry-anthology-continued-study-1483', // Eduqas: Anthology 2026
  'unseen-poetry',
  'modern-text-second-deep-dive-5143',  // AQA: Animal Farm
  'modern-text-second-deep-dive-5144',  // Edexcel: Animal Farm
  'modern-text-second-deep-dive-5034',  // AQA/Edexcel/Eduqas: An Inspector Calls
  'modern-text-second-deep-dive-194',   // AQA: Leave Taking
  'modern-text-second-deep-dive-1720',  // Eduqas: Leave Taking
  'spoken-language-masters-refining-public-speaking-skills',
  'modern-text-third-deep-dive-5145',   // AQA: Animal Farm
  'modern-text-third-deep-dive-5146',   // Edexcel: Animal Farm
  'modern-text-third-deep-dive-4768',   // AQA/Edexcel/Eduqas: An Inspector Calls
  'modern-text-third-deep-dive-5164',   // AQA: Leave Taking
  'modern-text-third-deep-dive-5165',   // Eduqas: Leave Taking
]);

/**
 * Oak API - Known Blocked/Unavailable Lesson Slugs
 *
 * This is a static blocklist of lesson slugs that are known to be inaccessible,
 * either returning 400/404 errors or explicit "Lesson not available" errors.
 */
export const BLOCKED_LESSON_SLUGS = new Set<string>([
  // --- COMPUTING PRIMARY ---
  'comparing-computer-art-and-painting', // Unit 1 Lesson 6
  'exploring-the-keyboard', // Unit 2 Lesson 1 (Covered by Unit block, but explicitly added per user report)
]);
