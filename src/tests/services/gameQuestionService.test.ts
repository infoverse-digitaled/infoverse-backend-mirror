import { generateQuestionPool, drawQuestion } from '../../services/gameQuestionService';
import { getGeminiClient, executeWithBackoff, checkRateLimit } from '../../services/geminiService';
import GameQuestion from '../../models/GameQuestion';

jest.mock('../../services/geminiService', () => ({
  __esModule: true,
  getGeminiClient: jest.fn(),
  executeWithBackoff: jest.fn(),
  checkRateLimit: jest.fn(),
}));
jest.mock('../../models/GameQuestion', () => ({
  __esModule: true,
  default: { insertMany: jest.fn(), aggregate: jest.fn(), updateOne: jest.fn() },
}));
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('gameQuestionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockReturnValue(true);
  });

  describe('generateQuestionPool', () => {
    it('parses a valid Gemini JSON response and bulk-inserts questions', async () => {
      const mockModel = {
        generateContent: jest.fn(),
      };
      (getGeminiClient as jest.Mock).mockReturnValue({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      });

      const payload = [
        {
          question: 'What is the capital of France?',
          options: ['Berlin', 'Madrid', 'Paris', 'Rome'],
          correctAnswerIndex: 2,
          explanation: 'Paris is the capital of France.',
        },
      ];
      (executeWithBackoff as jest.Mock).mockImplementation(async (op: () => Promise<unknown>) =>
        op(),
      );
      mockModel.generateContent.mockResolvedValue({
        response: Promise.resolve({ text: () => JSON.stringify(payload) }),
      });
      (GameQuestion.insertMany as jest.Mock).mockResolvedValue(payload);

      const count = await generateQuestionPool('ks2', 'geography', 3, 1, 'admin-1');

      expect(count).toBe(1);
      expect(GameQuestion.insertMany).toHaveBeenCalledWith([
        expect.objectContaining({
          keyStage: 'ks2',
          subject: 'geography',
          difficulty: 3,
          question: payload[0].question,
          correctAnswerIndex: 2,
        }),
      ]);
    });

    it('throws when Gemini returns no valid questions', async () => {
      const mockModel = { generateContent: jest.fn() };
      (getGeminiClient as jest.Mock).mockReturnValue({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      });
      (executeWithBackoff as jest.Mock).mockImplementation(async (op: () => Promise<unknown>) =>
        op(),
      );
      mockModel.generateContent.mockResolvedValue({
        response: Promise.resolve({ text: () => '[]' }),
      });

      await expect(generateQuestionPool('ks2', 'mixed', 1, 5, 'admin-1')).rejects.toThrow(
        'AI returned no valid questions',
      );
    });

    it('rejects when the admin is rate limited', async () => {
      (checkRateLimit as jest.Mock).mockReturnValue(false);

      await expect(generateQuestionPool('ks2', 'mixed', 1, 5, 'admin-1')).rejects.toThrow(
        'Too many requests',
      );
    });
  });

  describe('drawQuestion', () => {
    it('samples a question matching the filters and increments usageCount', async () => {
      const mockQuestion = { _id: 'q1', question: 'Q', options: ['a', 'b', 'c', 'd'] };
      (GameQuestion.aggregate as jest.Mock).mockResolvedValue([mockQuestion]);
      (GameQuestion.updateOne as jest.Mock).mockResolvedValue({});

      const result = await drawQuestion('ks2', 'mixed', 1, []);

      expect(result).toEqual(mockQuestion);
      expect(GameQuestion.updateOne).toHaveBeenCalledWith(
        { _id: 'q1' },
        { $inc: { usageCount: 1 } },
      );
    });

    it('throws NO_QUESTIONS_AVAILABLE when the pool is empty', async () => {
      (GameQuestion.aggregate as jest.Mock).mockResolvedValue([]);

      await expect(drawQuestion('ks2', 'mixed', 1, [])).rejects.toThrow('No questions available');
    });
  });
});
