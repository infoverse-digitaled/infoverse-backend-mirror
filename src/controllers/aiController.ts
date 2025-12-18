import { Request, Response, NextFunction } from 'express';
import { askTutor, generateSummary, explainSimply } from '../services/geminiService';
import { HttpError } from '../utils/httpError';
import { successResponse } from '../middleware/response';

// Extend Request to include user info from auth middleware
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    subscription?: {
      plan: 'free' | 'premium';
      status: string;
    };
  };
}

/**
 * AI Tutor endpoint - Answer questions about lesson content
 * POST /api/v1/ai/tutor
 */
export const tutorQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { context, question } = req.body;

    if (!user) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    if (!context || !question) {
      throw new HttpError(400, 'MISSING_FIELDS', 'context and question are required.');
    }

    if (question.length > 500) {
      throw new HttpError(400, 'QUESTION_TOO_LONG', 'Question must be 500 characters or less.');
    }

    if (context.length > 10000) {
      throw new HttpError(400, 'CONTEXT_TOO_LONG', 'Context must be 10,000 characters or less.');
    }

    const response = await askTutor(context, question, user.id);

    successResponse(res, { answer: response }, 'AI response generated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Generate summary of lesson content
 * POST /api/v1/ai/summary
 */
export const summarizeContent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { content } = req.body;

    if (!user) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    if (!content) {
      throw new HttpError(400, 'MISSING_CONTENT', 'content is required.');
    }

    if (content.length > 15000) {
      throw new HttpError(400, 'CONTENT_TOO_LONG', 'Content must be 15,000 characters or less.');
    }

    const summary = await generateSummary(content, user.id);

    successResponse(res, { summary }, 'Summary generated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Explain a concept simply
 * POST /api/v1/ai/explain
 */
export const explainConcept = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { concept, context } = req.body;

    if (!user) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    if (!concept) {
      throw new HttpError(400, 'MISSING_CONCEPT', 'concept is required.');
    }

    if (concept.length > 500) {
      throw new HttpError(400, 'CONCEPT_TOO_LONG', 'Concept must be 500 characters or less.');
    }

    const explanation = await explainSimply(concept, context || '', user.id);

    successResponse(res, { explanation }, 'Explanation generated successfully');
  } catch (err) {
    next(err);
  }
};
