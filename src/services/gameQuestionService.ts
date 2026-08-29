import { getGeminiClient, executeWithBackoff, checkRateLimit } from './geminiService';
import GameQuestion from '../models/GameQuestion';
import { HttpError } from '../utils/httpError';
import logger from '../utils/logger';

interface GeneratedQuestion {
  question: string;
  options: [string, string, string, string];
  correctAnswerIndex: number;
  explanation?: string;
}

const KEY_STAGE_LABELS: Record<string, string> = {
  ks1: 'Key Stage 1 (Years 1-2, ages 5-7)',
  ks2: 'Key Stage 2 (Years 3-6, ages 7-11)',
  ks3: 'Key Stage 3 (Years 7-9, ages 11-14)',
  ks4: 'Key Stage 4 (Years 10-11, ages 14-16)',
};

/**
 * Ask Gemini for a batch of multiple-choice trivia questions for a given key stage/subject/
 * difficulty rung, validate the shape, and bulk-insert them into the GameQuestion pool.
 * This is out-of-band pool maintenance (admin-triggered), not called during gameplay.
 */
export const generateQuestionPool = async (
  keyStage: 'ks1' | 'ks2' | 'ks3' | 'ks4',
  subject: string,
  difficulty: number,
  count: number,
  adminUserId: string,
  gameSlug: string = 'millionaire',
): Promise<number> => {
  if (!checkRateLimit(adminUserId)) {
    throw new HttpError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Too many requests. Please try again in a minute.',
    );
  }

  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const stageLabel = KEY_STAGE_LABELS[keyStage] ?? keyStage;
    const prompt = `You are generating trivia questions for a "Who Wants to Be a Millionaire"
style quiz game aimed at UK National Curriculum students.

TARGET AUDIENCE: ${stageLabel}
SUBJECT: ${subject === 'mixed' ? 'general knowledge across the curriculum' : subject}
DIFFICULTY: ${difficulty} out of 15 (1 is easiest, 15 is hardest for this key stage)
COUNT: generate exactly ${count} distinct questions

INSTRUCTIONS:
- Each question must have exactly 4 answer options, only one correct
- Questions must be age-appropriate for ${stageLabel}
- Avoid duplicate or near-duplicate questions
- Include a short one-sentence explanation of the correct answer
- Respond with ONLY a JSON array, no surrounding text, matching this shape:
[{"question": "...", "options": ["...","...","...","..."], "correctAnswerIndex": 0, "explanation": "..."}]`;

    const result = await executeWithBackoff(() => model.generateContent(prompt));
    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new HttpError(500, 'AI_EMPTY_RESPONSE', 'AI did not return a response.');
    }

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new HttpError(500, 'AI_INVALID_RESPONSE', 'AI response was not valid JSON.');
    }

    const parsed = JSON.parse(jsonMatch[0]) as GeneratedQuestion[];

    const validQuestions = parsed.filter(
      (q) =>
        typeof q.question === 'string' &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        Number.isInteger(q.correctAnswerIndex) &&
        q.correctAnswerIndex >= 0 &&
        q.correctAnswerIndex <= 3,
    );

    if (validQuestions.length === 0) {
      throw new HttpError(500, 'AI_INVALID_RESPONSE', 'AI returned no valid questions.');
    }

    const docs = validQuestions.map((q) => ({
      gameSlug,
      keyStage,
      subject,
      difficulty,
      question: q.question,
      options: q.options,
      correctAnswerIndex: q.correctAnswerIndex,
      explanation: q.explanation,
    }));

    await GameQuestion.insertMany(docs);

    logger.info(
      `Generated ${docs.length} game questions (${gameSlug}/${keyStage}/${subject}/d${difficulty}) by admin ${adminUserId}`,
    );

    return docs.length;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    logger.error('Gemini question generation error:', error);
    throw new HttpError(500, 'AI_ERROR', 'Failed to generate question pool. Please try again.');
  }
};

/**
 * Draw a random question from the pool for the given filters, preferring less-used questions
 * to spread repeats. Excludes question ids already asked in the current session.
 */
export const drawQuestion = async (
  keyStage: 'ks1' | 'ks2' | 'ks3' | 'ks4',
  subject: string,
  difficulty: number,
  excludeIds: string[] = [],
  gameSlug: string = 'millionaire',
) => {
  const match: Record<string, unknown> = {
    gameSlug,
    keyStage,
    difficulty,
  };
  if (subject && subject !== 'mixed') {
    match.subject = subject;
  }
  if (excludeIds.length > 0) {
    match._id = { $nin: excludeIds };
  }

  const [question] = await GameQuestion.aggregate([
    { $match: match },
    { $sort: { usageCount: 1 } },
    { $limit: 20 },
    { $sample: { size: 1 } },
  ]);

  if (!question) {
    throw new HttpError(
      404,
      'NO_QUESTIONS_AVAILABLE',
      'No questions available for this key stage/difficulty. Please try again later.',
    );
  }

  await GameQuestion.updateOne({ _id: question._id }, { $inc: { usageCount: 1 } });

  return question;
};

export default {
  generateQuestionPool,
  drawQuestion,
};
