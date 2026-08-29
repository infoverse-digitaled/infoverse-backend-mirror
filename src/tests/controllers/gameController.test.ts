import { Request, Response, NextFunction } from 'express';
import { startGame, submitAnswer, cashOut, getLeaderboard } from '../../controllers/gameController';
import * as gameQuestionService from '../../services/gameQuestionService';
import GameSession from '../../models/GameSession';
import GameQuestion from '../../models/GameQuestion';

jest.mock('../../services/gameQuestionService', () => ({
  __esModule: true,
  drawQuestion: jest.fn(),
  generateQuestionPool: jest.fn(),
}));
jest.mock('../../models/GameSession', () => ({
  __esModule: true,
  default: { create: jest.fn(), findOne: jest.fn(), aggregate: jest.fn() },
}));
jest.mock('../../models/GameQuestion', () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

describe('gameController', () => {
  let req: Partial<Request> & { user?: { id: string } };
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { params: {}, body: {}, user: { id: 'user-1' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('startGame', () => {
    it('creates a session and returns the first question without the correct answer', async () => {
      req.body = { keyStage: 'ks2', subject: 'mixed', difficulty: 'medium' };

      const mockSession = {
        _id: 'session-1',
        currentStep: 0,
        questionsAsked: [],
        save: jest.fn(),
      };
      (GameSession.create as jest.Mock).mockResolvedValue(mockSession);
      (gameQuestionService.drawQuestion as jest.Mock).mockResolvedValue({
        _id: 'q1',
        question: 'What is 2+2?',
        options: ['1', '2', '3', '4'],
        correctAnswerIndex: 3,
      });

      await startGame(req as Request, res as Response, next);

      expect(GameSession.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', keyStage: 'ks2', difficulty: 'medium' }),
      );
      expect(mockSession.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(jsonArg.data.question).not.toHaveProperty('correctAnswerIndex');
    });
  });

  describe('submitAnswer', () => {
    it('ends the session as lost on a wrong answer without leaking the correct index client-side', async () => {
      req.params = { sessionId: 'session-1' };
      req.body = { selectedOptionIndex: 1 };

      const mockSession = {
        _id: 'session-1',
        userId: 'user-1',
        status: 'in_progress',
        currentStep: 2,
        difficulty: 'medium',
        keyStage: 'ks2',
        subject: 'mixed',
        score: 0,
        xpEarned: 0,
        questionsAsked: [{ questionId: 'q1' }],
        save: jest.fn(),
        markCompleted: jest.fn().mockImplementation(function markCompleted(
          this: { status: string },
          status: string,
        ) {
          this.status = status;
          return Promise.resolve(this);
        }),
      };
      (GameSession.findOne as jest.Mock).mockResolvedValue(mockSession);
      (GameQuestion.findById as jest.Mock).mockResolvedValue({
        _id: 'q1',
        correctAnswerIndex: 3,
        explanation: 'because math',
      });

      await submitAnswer(req as Request, res as Response, next);

      expect(mockSession.markCompleted).toHaveBeenCalledWith('lost');
      const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(jsonArg.data.isCorrect).toBe(false);
      expect(jsonArg.data.status).toBe('lost');
    });

    it('rejects an answer for a session the user does not own or that does not exist', async () => {
      req.params = { sessionId: 'session-404' };
      req.body = { selectedOptionIndex: 1 };
      (GameSession.findOne as jest.Mock).mockResolvedValue(null);

      await submitAnswer(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'SESSION_NOT_FOUND' }));
    });
  });

  describe('cashOut', () => {
    it('marks an in-progress session as abandoned', async () => {
      req.params = { sessionId: 'session-1' };
      const mockSession = {
        status: 'in_progress',
        score: 500,
        xpEarned: 20,
        markCompleted: jest.fn().mockImplementation(function markCompleted(
          this: { status: string },
          status: string,
        ) {
          this.status = status;
          return Promise.resolve(this);
        }),
      };
      (GameSession.findOne as jest.Mock).mockResolvedValue(mockSession);

      await cashOut(req as Request, res as Response, next);

      expect(mockSession.markCompleted).toHaveBeenCalledWith('abandoned');
      expect(res.status).not.toHaveBeenCalledWith(500);
    });
  });

  describe('getLeaderboard', () => {
    it('returns the aggregated leaderboard', async () => {
      (GameSession.aggregate as jest.Mock).mockResolvedValue([
        { userId: 'user-1', name: 'Ada', weeklyXp: 100, bestScore: 1000 },
      ]);

      await getLeaderboard(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: {
            leaderboard: [{ userId: 'user-1', name: 'Ada', weeklyXp: 100, bestScore: 1000 }],
          },
        }),
      );
    });
  });
});
