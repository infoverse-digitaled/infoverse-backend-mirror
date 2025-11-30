import { Request, Response, NextFunction } from 'express';
import {
  getKeyStages,
  getSubjects,
  getUnits,
  getLessons,
  getLessonDetails,
  searchLessons,
} from '../../controllers/oakContentController';
import oakApiService from '../../services/oakApiService';

// Mock the entire oakApiService module
jest.mock('../../services/oakApiService', () => ({
  __esModule: true,
  default: {
    getKeyStages: jest.fn(),
    getSubjectsByKeyStage: jest.fn(),
    getUnits: jest.fn(),
    getLessons: jest.fn(),
    getLessonDetails: jest.fn(),
    searchLessons: jest.fn(),
  },
}));

describe('OakContentController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      params: {},
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('getKeyStages', () => {
    it('should get key stages and return 200', async () => {
      const mockData = [{ slug: 'ks1', title: 'Key Stage 1' }];
      (oakApiService.getKeyStages as jest.Mock).mockResolvedValue(mockData);

      await getKeyStages(req as Request, res as Response, next);

      expect(oakApiService.getKeyStages).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Key stages retrieved successfully',
        data: mockData,
      });
    });

    it('should handle errors', async () => {
      const error = new Error('Test error');
      (oakApiService.getKeyStages as jest.Mock).mockRejectedValue(error);

      await getKeyStages(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getSubjects', () => {
    it('should get subjects and return 200', async () => {
      req.params = { keyStage: 'ks1' };
      const mockData = [{ slug: 'maths', title: 'Maths' }];
      (oakApiService.getSubjectsByKeyStage as jest.Mock).mockResolvedValue(mockData);

      await getSubjects(req as Request, res as Response, next);

      expect(oakApiService.getSubjectsByKeyStage).toHaveBeenCalledWith('ks1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Subjects retrieved successfully',
        data: mockData,
      });
    });

    it('should handle errors', async () => {
      req.params = { keyStage: 'ks1' };
      const error = new Error('Test error');
      (oakApiService.getSubjectsByKeyStage as jest.Mock).mockRejectedValue(error);

      await getSubjects(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getUnits', () => {
    it('should get units and return 200', async () => {
      req.params = { keyStage: 'ks1', subjectSlug: 'maths' };
      const mockData = [{ slug: 'unit1', title: 'Unit 1' }];
      (oakApiService.getUnits as jest.Mock).mockResolvedValue(mockData);

      await getUnits(req as Request, res as Response, next);

      expect(oakApiService.getUnits).toHaveBeenCalledWith('ks1', 'maths');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Units retrieved successfully',
        data: mockData,
      });
    });

    it('should handle errors', async () => {
      req.params = { keyStage: 'ks1', subjectSlug: 'maths' };
      const error = new Error('Test error');
      (oakApiService.getUnits as jest.Mock).mockRejectedValue(error);

      await getUnits(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getLessons', () => {
    it('should get lessons and return 200', async () => {
      req.params = { unitSlug: 'unit1' };
      const mockData = [{ slug: 'lesson1', title: 'Lesson 1' }];
      (oakApiService.getLessons as jest.Mock).mockResolvedValue(mockData);

      await getLessons(req as Request, res as Response, next);

      expect(oakApiService.getLessons).toHaveBeenCalledWith('unit1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Lessons retrieved successfully',
        data: mockData,
      });
    });

    it('should handle errors', async () => {
      req.params = { unitSlug: 'unit1' };
      const error = new Error('Test error');
      (oakApiService.getLessons as jest.Mock).mockRejectedValue(error);

      await getLessons(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getLessonDetails', () => {
    it('should get lesson details and return 200', async () => {
      req.params = { lessonSlug: 'lesson1' };
      const mockData = { slug: 'lesson1', title: 'Lesson 1', content: {} };
      (oakApiService.getLessonDetails as jest.Mock).mockResolvedValue(mockData);

      await getLessonDetails(req as Request, res as Response, next);

      expect(oakApiService.getLessonDetails).toHaveBeenCalledWith('lesson1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Lesson details retrieved successfully',
        data: mockData,
      });
    });

    it('should handle errors', async () => {
      req.params = { lessonSlug: 'lesson1' };
      const error = new Error('Test error');
      (oakApiService.getLessonDetails as jest.Mock).mockRejectedValue(error);

      await getLessonDetails(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('searchLessons', () => {
    it('should search lessons and return 200', async () => {
      req.query = { q: 'math', keyStage: 'ks1', page: '1', limit: '10' };
      const mockData = { results: [], total: 0 };
      (oakApiService.searchLessons as jest.Mock).mockResolvedValue(mockData);

      await searchLessons(req as Request, res as Response, next);

      expect(oakApiService.searchLessons).toHaveBeenCalledWith('math', {
        keyStage: 'ks1',
        subjectSlug: undefined, // "subject" query param maps to "subjectSlug" filter
        yearSlug: undefined,
        page: 1,
        limit: 10,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Search results retrieved successfully',
        data: mockData,
      });
    });

    it('should throw 400 if q is missing', async () => {
      req.query = {}; // Missing q

      await searchLessons(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Object));
      // Optionally check error message/code if HttpError is exposed or check strict equality if we can import the error instance
    });

    it('should handle service errors', async () => {
      req.query = { q: 'math' };
      const error = new Error('Test error');
      (oakApiService.searchLessons as jest.Mock).mockRejectedValue(error);

      await searchLessons(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
