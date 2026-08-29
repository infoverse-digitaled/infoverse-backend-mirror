import { Request, Response, NextFunction } from 'express';
import GameSession from '../models/GameSession';
import GameQuestion from '../models/GameQuestion';
import { drawQuestion, generateQuestionPool } from '../services/gameQuestionService';
import { HttpError } from '../utils/httpError';
import { successResponse } from '../middleware/response';
import {
  MAX_QUESTIONS,
  MONEY_LADDER,
  SAFE_HAVEN_STEPS,
  XP_PER_STEP,
  resolveQuestionDifficulty,
} from '../config/game';
import { UserWithSubscription } from '../utils/subscriptionUtils';

interface AuthenticatedRequest extends Request {
  user?: UserWithSubscription;
}

const sanitizeQuestion = (question: { _id: unknown; question: string; options: string[] }) => ({
  id: question._id,
  question: question.question,
  options: question.options,
});

/**
 * Start a new Millionaire game session for the given key stage/subject/difficulty band.
 * POST /game/millionaire/start
 */
export const startGame = async (req: Request, res: Response, next: NextFunction) => {
  const { user } = req as AuthenticatedRequest;
  if (!user) {
    return next(new HttpError(401, 'UNAUTHORIZED', 'User not authenticated.'));
  }

  try {
    const {
      keyStage,
      subject = 'mixed',
      difficulty,
    } = req.body as {
      keyStage: 'ks1' | 'ks2' | 'ks3' | 'ks4';
      subject?: string;
      difficulty: 'easy' | 'medium' | 'hard';
    };

    const session = await GameSession.create({
      userId: user.id,
      gameSlug: 'millionaire',
      keyStage,
      subject,
      difficulty,
      currentStep: 0,
      status: 'in_progress',
    });

    const questionDifficulty = resolveQuestionDifficulty(0, difficulty);
    const question = await drawQuestion(keyStage, subject, questionDifficulty);

    session.questionsAsked.push({ questionId: question._id });
    await session.save();

    return successResponse(
      res,
      {
        sessionId: session._id,
        currentStep: session.currentStep,
        moneyLadder: MONEY_LADDER,
        question: sanitizeQuestion(question),
      },
      'Game started',
      201,
    );
  } catch (err) {
    return next(err);
  }
};

/**
 * Submit an answer for the current question in a session. Validated server-side.
 * POST /game/millionaire/:sessionId/answer
 */
export const submitAnswer = async (req: Request, res: Response, next: NextFunction) => {
  const { user } = req as AuthenticatedRequest;
  if (!user) {
    return next(new HttpError(401, 'UNAUTHORIZED', 'User not authenticated.'));
  }

  try {
    const { sessionId } = req.params;
    const { selectedOptionIndex } = req.body as { selectedOptionIndex: number };

    const session = await GameSession.findOne({ _id: sessionId, userId: user.id });
    if (!session) {
      throw new HttpError(404, 'SESSION_NOT_FOUND', 'Game session not found.');
    }
    if (session.status !== 'in_progress') {
      throw new HttpError(400, 'SESSION_NOT_ACTIVE', 'This game session has already ended.');
    }

    const currentAsk = session.questionsAsked[session.questionsAsked.length - 1];
    const question = await GameQuestion.findById(currentAsk.questionId);
    if (!question) {
      throw new HttpError(404, 'QUESTION_NOT_FOUND', 'Question for this step not found.');
    }

    const isCorrect = question.correctAnswerIndex === selectedOptionIndex;
    currentAsk.selectedOptionIndex = selectedOptionIndex;
    currentAsk.isCorrect = isCorrect;
    currentAsk.answeredAt = new Date();

    if (!isCorrect) {
      const safeStep = [...SAFE_HAVEN_STEPS].reverse().find((s) => s < session.currentStep);
      session.score = safeStep !== undefined ? MONEY_LADDER[safeStep] : 0;
      await session.markCompleted('lost');

      return successResponse(res, {
        isCorrect: false,
        explanation: question.explanation,
        correctAnswerIndex: question.correctAnswerIndex,
        status: session.status,
        score: session.score,
      });
    }

    session.currentStep += 1;
    session.score = MONEY_LADDER[session.currentStep - 1];
    session.xpEarned += XP_PER_STEP;

    if (session.currentStep >= MAX_QUESTIONS) {
      await session.save();
      await session.markCompleted('won');
      return successResponse(res, {
        isCorrect: true,
        explanation: question.explanation,
        status: session.status,
        score: session.score,
        xpEarned: session.xpEarned,
      });
    }

    const questionDifficulty = resolveQuestionDifficulty(session.currentStep, session.difficulty);
    const excludeIds = session.questionsAsked.map((q) => q.questionId.toString());
    const nextQuestion = await drawQuestion(
      session.keyStage,
      session.subject,
      questionDifficulty,
      excludeIds,
    );
    session.questionsAsked.push({ questionId: nextQuestion._id });
    await session.save();

    return successResponse(res, {
      isCorrect: true,
      explanation: question.explanation,
      status: session.status,
      currentStep: session.currentStep,
      score: session.score,
      xpEarned: session.xpEarned,
      nextQuestion: sanitizeQuestion(nextQuestion),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * Cash out of an in-progress session, keeping the current score.
 * POST /game/millionaire/:sessionId/cashout
 */
export const cashOut = async (req: Request, res: Response, next: NextFunction) => {
  const { user } = req as AuthenticatedRequest;
  if (!user) {
    return next(new HttpError(401, 'UNAUTHORIZED', 'User not authenticated.'));
  }

  try {
    const { sessionId } = req.params;
    const session = await GameSession.findOne({ _id: sessionId, userId: user.id });
    if (!session) {
      throw new HttpError(404, 'SESSION_NOT_FOUND', 'Game session not found.');
    }
    if (session.status !== 'in_progress') {
      throw new HttpError(400, 'SESSION_NOT_ACTIVE', 'This game session has already ended.');
    }

    await session.markCompleted('abandoned');

    return successResponse(res, {
      status: session.status,
      score: session.score,
      xpEarned: session.xpEarned,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * Weekly leaderboard aggregated from completed sessions.
 * GET /game/leaderboard
 */
export const getLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const leaderboard = await GameSession.aggregate([
      {
        $match: {
          gameSlug: 'millionaire',
          status: { $in: ['won', 'lost'] },
          completedAt: { $gte: oneWeekAgo },
        },
      },
      {
        $group: {
          _id: '$userId',
          weeklyXp: { $sum: '$xpEarned' },
          bestScore: { $max: '$score' },
        },
      },
      { $sort: { weeklyXp: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          name: '$user.name',
          weeklyXp: 1,
          bestScore: 1,
        },
      },
    ]);

    successResponse(res, { leaderboard });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin: trigger Gemini-backed generation of a question pool batch.
 * POST /game/admin/millionaire/generate-pool
 */
export const generatePool = async (req: Request, res: Response, next: NextFunction) => {
  const { user } = req as AuthenticatedRequest;
  if (!user) {
    return next(new HttpError(401, 'UNAUTHORIZED', 'User not authenticated.'));
  }

  try {
    const {
      keyStage,
      subject = 'mixed',
      difficulty,
      count = 10,
    } = req.body as {
      keyStage: 'ks1' | 'ks2' | 'ks3' | 'ks4';
      subject?: string;
      difficulty: number;
      count?: number;
    };

    const created = await generateQuestionPool(keyStage, subject, difficulty, count, user.id);

    return successResponse(res, { created }, 'Question pool generated', 201);
  } catch (err) {
    return next(err);
  }
};
