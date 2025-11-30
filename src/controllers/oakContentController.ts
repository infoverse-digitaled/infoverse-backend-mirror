import { Request, Response, NextFunction } from 'express';
import oakApiService from '../services/oakApiService';
import { successResponse } from '../middleware/response';
import { HttpError } from '../utils/httpError';

/**
 * Get all key stages
 */
export const getKeyStages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const keyStages = await oakApiService.getKeyStages();
    successResponse(res, keyStages, 'Key stages retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get subjects by key stage
 */
export const getSubjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { keyStage } = req.params;
    const subjects = await oakApiService.getSubjectsByKeyStage(keyStage);
    successResponse(res, subjects, 'Subjects retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get units by key stage and subject
 */
export const getUnits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { keyStage, subjectSlug } = req.params;
    const units = await oakApiService.getUnits(keyStage, subjectSlug);
    successResponse(res, units, 'Units retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get lessons by unit
 */
export const getLessons = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { unitSlug } = req.params;
    const lessons = await oakApiService.getLessons(unitSlug);
    successResponse(res, lessons, 'Lessons retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get lesson details
 */
export const getLessonDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lessonSlug } = req.params;
    const lessonDetails = await oakApiService.getLessonDetails(lessonSlug);
    successResponse(res, lessonDetails, 'Lesson details retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Search lessons
 */
export const searchLessons = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, keyStage, subject, year, page, limit } = req.query;

    if (!q || typeof q !== 'string') {
      throw new HttpError(400, 'Search query "q" is required', 'BAD_REQUEST');
    }

    const filters = {
      keyStage: keyStage as string,
      subjectSlug: subject as string,
      yearSlug: year as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
    };

    const results = await oakApiService.searchLessons(q, filters);
    successResponse(res, results, 'Search results retrieved successfully');
  } catch (error) {
    next(error);
  }
};
