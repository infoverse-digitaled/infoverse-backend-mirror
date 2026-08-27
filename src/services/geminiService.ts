import { GoogleGenerativeAI } from '@google/generative-ai';
import { HttpError } from '../utils/httpError';
import logger from '../utils/logger';

// Initialize Gemini client
let genAI: GoogleGenerativeAI | null = null;

const getGeminiClient = (): GoogleGenerativeAI => {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new HttpError(500, 'AI_NOT_CONFIGURED', 'Gemini API key is not configured.');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
};

// Rate limiting tracking
const userRequests = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute in ms

/**
 retry Gemini requests with exponential backoff
 */
const executeWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 2000,
): Promise<T> => {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      attempt++;

      // We only want to retry on specific transient errors (429 Rate Limit, 503 Unavaiable)
      // If error is something else, or we're on the last attempt, immediately throw
      if (
        attempt >= maxRetries ||
        (error.status && error.status !== 429 && error.status !== 500 && error.status !== 503)
      ) {
        throw error;
      }

      // Calculate delay: baseDelay * 2^(attempt - 1)
      const delay = baseDelay * 2 ** (attempt - 1);
      logger.warn(
        `[Gemini] API request failed. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Exponential backoff failed');
};

/**
 * Check if user has exceeded rate limit
 */
export const checkRateLimit = (userId: string): boolean => {
  const now = Date.now();
  const userRate = userRequests.get(userId);

  if (!userRate || now > userRate.resetTime) {
    // Reset or initialize rate limit
    userRequests.set(userId, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (userRate.count >= RATE_LIMIT) {
    return false;
  }

  userRate.count++;
  return true;
};

/**
 * AI Tutor - Answer student questions about lesson content
 */
export const askTutor = async (
  context: string,
  question: string,
  userId: string,
): Promise<string> => {
  // Check rate limit
  if (!checkRateLimit(userId)) {
    throw new HttpError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Too many requests. Please try again in a minute.',
    );
  }

  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are a helpful AI tutor for UK National Curriculum students.
Your role is to help students understand their lessons better.

LESSON CONTEXT:
${context}

STUDENT QUESTION:
${question}

INSTRUCTIONS:
- Provide a clear, age-appropriate explanation
- Use simple language that students can understand
- If the question is not related to the lesson, politely redirect to the lesson topic
- Be encouraging and supportive
- Keep responses concise but thorough
- Use examples when helpful

Please answer the student's question:`;

    const result = await executeWithBackoff(() => model.generateContent(prompt));
    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new HttpError(500, 'AI_EMPTY_RESPONSE', 'AI did not return a response.');
    }

    logger.info(`AI Tutor response generated for user ${userId}`);
    return text;
  } catch (error: any) {
    if (error instanceof HttpError) {
      throw error;
    }
    // Log detailed error info including cause chain
    logger.error('Gemini API error:', {
      message: error?.message,
      name: error?.name,
      cause: error?.cause?.message || error?.cause,
      causeCode: error?.cause?.code,
      errno: error?.cause?.errno,
      syscall: error?.cause?.syscall,
      stack: error?.stack?.split('\n').slice(0, 5).join('\n'),
    });
    throw new HttpError(500, 'AI_ERROR', 'Failed to generate AI response. Please try again.');
  }
};

/**
 * Generate a summary of lesson content
 */
export const generateSummary = async (content: string, userId: string): Promise<string> => {
  // Check rate limit
  if (!checkRateLimit(userId)) {
    throw new HttpError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Too many requests. Please try again in a minute.',
    );
  }

  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are an educational content summarizer for UK National Curriculum students.

LESSON CONTENT:
${content}

INSTRUCTIONS:
- Create a concise summary of the key learning points
- Use bullet points for easy reading
- Highlight the most important concepts
- Keep language age-appropriate
- Include 3-5 main takeaways

Generate a summary:`;

    const result = await executeWithBackoff(() => model.generateContent(prompt));
    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new HttpError(500, 'AI_EMPTY_RESPONSE', 'AI did not return a response.');
    }

    return text;
  } catch (error: any) {
    if (error instanceof HttpError) {
      throw error;
    }
    logger.error('Gemini API error:', error);
    throw new HttpError(500, 'AI_ERROR', 'Failed to generate summary. Please try again.');
  }
};

/**
 * Explain a concept in simpler terms
 */
export const explainSimply = async (
  concept: string,
  context: string,
  userId: string,
): Promise<string> => {
  // Check rate limit
  if (!checkRateLimit(userId)) {
    throw new HttpError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Too many requests. Please try again in a minute.',
    );
  }

  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are an educational assistant helping students understand difficult concepts.

LESSON CONTEXT:
${context}

CONCEPT TO EXPLAIN:
${concept}

INSTRUCTIONS:
- Explain this concept as simply as possible
- Use everyday examples and analogies
- Break down complex ideas into smaller parts
- Make it engaging and memorable
- Suitable for school-age children

Explain the concept:`;

    const result = await executeWithBackoff(() => model.generateContent(prompt));
    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new HttpError(500, 'AI_EMPTY_RESPONSE', 'AI did not return a response.');
    }

    return text;
  } catch (error: any) {
    if (error instanceof HttpError) {
      throw error;
    }
    logger.error('Gemini API error:', error);
    throw new HttpError(500, 'AI_ERROR', 'Failed to explain concept. Please try again.');
  }
};

export default {
  askTutor,
  generateSummary,
  explainSimply,
  checkRateLimit,
};
