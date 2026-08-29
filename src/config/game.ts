// Millionaire game constants

export const MAX_QUESTIONS = 15;

// Classic "Who Wants to Be a Millionaire" money ladder (Naira), one entry per step (0-14)
export const MONEY_LADDER = [
  100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000,
];

// Rung "safe havens" - reaching these steps locks in a minimum payout even on a later loss
export const SAFE_HAVEN_STEPS = [4, 9, 14];

// Question difficulty (GameQuestion.difficulty, 1-15) naturally rises with the current step
// (step 0 -> difficulty 1, step 14 -> difficulty 15). The user-facing Easy/Medium/Hard toggle
// shifts that curve up or down rather than pinning play to a fixed rung range, so a session can
// stay easier or harder throughout while the ladder still progresses normally.
export const DIFFICULTY_STEP_OFFSET: Record<'easy' | 'medium' | 'hard', number> = {
  easy: -3,
  medium: 0,
  hard: 3,
};

// Given the current step (0-14) and chosen difficulty band, returns the GameQuestion.difficulty
// (1-15) to draw from.
export function resolveQuestionDifficulty(
  currentStep: number,
  band: 'easy' | 'medium' | 'hard',
): number {
  const raw = currentStep + 1 + DIFFICULTY_STEP_OFFSET[band];
  return Math.min(15, Math.max(1, raw));
}

// XP awarded per correctly-answered rung
export const XP_PER_STEP = 10;
