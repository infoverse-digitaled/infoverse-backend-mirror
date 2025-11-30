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

// Mock config with PAID_SUBJECTS
jest.mock('../../config/curriculum', () => ({
  PAID_SUBJECTS: ['german', 'french'],
}));

describe('OakContentController', () => {
  let req: Partial<Request> & { user?: any };
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      params: {},
      query: {},
      // No user by default (implies Free user)
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('getKeyStages', () => {
    it('should get key stages and return 200 with meta.showAds = true for free user', async () => {
      const mockData = [{ slug: 'ks1', title: 'Key Stage 1' }];
      (oakApiService.getKeyStages as jest.Mock).mockResolvedValue(mockData);

      await getKeyStages(req as Request, res as Response, next);

      expect(oakApiService.getKeyStages).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Key stages retrieved successfully',
        data: mockData,
        meta: { showAds: true },
      });
    });

    it('should get key stages with meta.showAds = false for premium user', async () => {
      req.user = { subscription: { plan: 'premium', status: 'active' } };
      const mockData = [{ slug: 'ks1', title: 'Key Stage 1' }];
      (oakApiService.getKeyStages as jest.Mock).mockResolvedValue(mockData);

      await getKeyStages(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Key stages retrieved successfully',
        data: mockData,
        meta: { showAds: false },
      });
    });
  });

  describe('getSubjects', () => {
    it('should get subjects and return 200', async () => {
      req.params = { keyStage: 'ks1' };
      const mockData = [{ slug: 'maths', title: 'Maths' }];
      (oakApiService.getSubjectsByKeyStage as jest.Mock).mockResolvedValue(mockData);

      await getSubjects(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Subjects retrieved successfully',
        data: mockData,
        meta: { showAds: true },
      });
    });

    it('should mark paid subjects as locked for free user', async () => {
      req.params = { keyStage: 'ks1' };
      const mockData = [
        { slug: 'maths', title: 'Maths' },
        { slug: 'german', title: 'German' }, // Paid subject
      ];
      (oakApiService.getSubjectsByKeyStage as jest.Mock).mockResolvedValue(mockData);

      await getSubjects(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Subjects retrieved successfully',
        data: [
          { slug: 'maths', title: 'Maths' },
          { slug: 'german', title: 'German', locked: true },
        ],
        meta: { showAds: true },
      });
    });
  });

  describe('getLessons', () => {
    it('should limit lessons to 1 for free user on free subject', async () => {
      req.params = { unitSlug: 'unit1' };
      const mockData = [
        { slug: 'lesson1', title: 'Lesson 1', subjectSlug: 'maths' },
        { slug: 'lesson2', title: 'Lesson 2', subjectSlug: 'maths' },
      ];
      (oakApiService.getLessons as jest.Mock).mockResolvedValue(mockData);

      await getLessons(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Lessons retrieved successfully',
        data: [{ slug: 'lesson1', title: 'Lesson 1', subjectSlug: 'maths' }], // Only 1 lesson
        meta: { showAds: true },
      });
    });

    it('should return all lessons for premium user', async () => {
      req.params = { unitSlug: 'unit1' };
      req.user = { subscription: { plan: 'premium' } };
      const mockData = [
        { slug: 'lesson1', title: 'Lesson 1', subjectSlug: 'maths' },
        { slug: 'lesson2', title: 'Lesson 2', subjectSlug: 'maths' },
      ];
      (oakApiService.getLessons as jest.Mock).mockResolvedValue(mockData);

      await getLessons(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Lessons retrieved successfully',
        data: mockData, // All lessons
        meta: { showAds: false },
      });
    });

    it('should block paid subjects for free user', async () => {
      req.params = { unitSlug: 'unit1' };
      const mockData = [{ slug: 'lesson1', title: 'Lesson 1', subjectSlug: 'german' }];
      (oakApiService.getLessons as jest.Mock).mockResolvedValue(mockData);

      await getLessons(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    });
  });

  // Other tests remain similar just adding meta expectation
  describe('searchLessons', () => {
    it('should search lessons and return 200', async () => {
      req.query = { q: 'math', keyStage: 'ks1', page: '1', limit: '10' };
      const mockData = { results: [], total: 0 };
      (oakApiService.searchLessons as jest.Mock).mockResolvedValue(mockData);

      await searchLessons(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Search results retrieved successfully',
        data: mockData,
        meta: { showAds: true },
      });
    });
  });
});