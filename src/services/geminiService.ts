import { GoogleGenAI } from '@google/genai';
import { HttpError } from '../utils/httpError';
import logger from '../utils/logger';

// Initialize Gemini client
let genAI: GoogleGenAI | null = null;

const getGeminiClient = (): GoogleGenAI => {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new HttpError(500, 'AI_NOT_CONFIGURED', 'Gemini API key is not configured.');
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
};

// Rate limiting tracking
const userRequests = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute in ms

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
  userId: string
): Promise<string> => {
  // Check rate limit
  if (!checkRateLimit(userId)) {
    throw new HttpError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again in a minute.');
  }

  try {
    const client = getGeminiClient();

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

    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const text = response.text;

    if (!text) {
      throw new HttpError(500, 'AI_EMPTY_RESPONSE', 'AI did not return a response.');
    }

    logger.info(`AI Tutor response generated for user ${userId}`);
    return text;
  } catch (error: any) {
    if (error instanceof HttpError) {
      throw error;
    }
    logger.error('Gemini API error:', error);
    throw new HttpError(500, 'AI_ERROR', 'Failed to generate AI response. Please try again.');
  }
};

/**
 * Generate a summary of lesson content
 */
export const generateSummary = async (
  content: string,
  userId: string
): Promise<string> => {
  // Check rate limit
  if (!checkRateLimit(userId)) {
    throw new HttpError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again in a minute.');
  }

  try {
    const client = getGeminiClient();

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

    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const text = response.text;

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
  userId: string
): Promise<string> => {
  // Check rate limit
  if (!checkRateLimit(userId)) {
    throw new HttpError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again in a minute.');
  }

  try {
    const client = getGeminiClient();

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

    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const text = response.text;

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
