import { Request, Response, NextFunction } from 'express';
import oakApiService from '../services/oakApiService';
import { successResponse } from '../middleware/response';
import { HttpError } from '../utils/httpError';
import { PAID_SUBJECTS, ALLOWED_SUBJECTS } from '../config/curriculum';

// Extend Request to include user info from optionalAuth
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    name: string;
    email: string;
    subscription?: {
      plan: 'free' | 'premium';
      status: 'active' | 'trialing' | 'inactive' | 'cancelled' | 'past_due' | 'free';
      expiresAt?: Date;
      trialEndsAt?: Date;
    };
  };
}

const isFreeUser = (req: AuthenticatedRequest): boolean => {
  // Check subscription status to determine access level
  // Premium Access (return false): status is 'active' OR ('trialing' AND not expired)
  // Restricted Access (return true): all other cases

  if (!req.user) return true;
  if (!req.user.subscription) return true; // Default to free if missing

  const { status, trialEndsAt } = req.user.subscription;

  // Users with active subscription get full access
  if (status === 'active') {
    return false;
  }

  // Users in trial get full access if the trial hasn't expired
  if (status === 'trialing') {
     if (trialEndsAt && new Date(trialEndsAt) > new Date()) {
       return false;
     }
     // Trial expired
     return true;
  }

  // All other statuses (free, past_due, cancelled, inactive) are restricted
  return true;
};

const getMeta = (req: AuthenticatedRequest) => {
  return {
    showAds: isFreeUser(req),
  };
};

/**
 * Get all key stages
 */
export const getKeyStages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const keyStages = await oakApiService.getKeyStages();
    successResponse(res, keyStages, 'Key stages retrieved successfully', 200, getMeta(req as AuthenticatedRequest));
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

    // Get subjects from Oak API - now properly unwrapped to array
    let subjects: any[] = await oakApiService.getSubjectsByKeyStage(keyStage);

    // Step 1: Filter subjects to only those allowed for this key stage
    const allowedSubjectsForKeyStage = ALLOWED_SUBJECTS[keyStage] || [];
    subjects = subjects.filter((subject) => allowedSubjectsForKeyStage.includes(subject.slug));

    // Step 2: Lock paid subjects for free users
    const freeUser = isFreeUser(req as AuthenticatedRequest);
    if (freeUser) {
      subjects.forEach((subject) => {
        if (PAID_SUBJECTS.includes(subject.slug)) {
          subject.locked = true;
        }
      });
    }

    successResponse(res, subjects, 'Subjects retrieved successfully', 200, getMeta(req as AuthenticatedRequest));
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
    successResponse(res, units, 'Units retrieved successfully', 200, getMeta(req as AuthenticatedRequest));
  } catch (error) {
    next(error);
  }
};

/**
 * Get unit details by slug
 */
export const getUnitDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { unitSlug } = req.params;
    const unit = await oakApiService.getUnitDetails(unitSlug);
    successResponse(res, unit, 'Unit details retrieved successfully', 200, getMeta(req as AuthenticatedRequest));
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
    let lessons = await oakApiService.getLessons(unitSlug);
    const freeUser = isFreeUser(req as AuthenticatedRequest);

    if (freeUser && lessons.length > 0) {
      // Assuming all lessons in the list belong to the same subject
      // We check the first one to determine the subject
      const subjectSlug = lessons[0].subjectSlug;

      if (PAID_SUBJECTS.includes(subjectSlug)) {
        // Paid subject: return 403 or empty.
        // Prompt says "return empty list or 403". 403 is more informative.
        throw new HttpError(403, 'This content requires a premium subscription', 'PREMIUM_REQUIRED');
      } else {
        // Free subject: return only the first 1 lesson
        lessons = lessons.slice(0, 1);
      }
    }

    successResponse(res, lessons, 'Lessons retrieved successfully', 200, getMeta(req as AuthenticatedRequest));
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
    successResponse(res, lessonDetails, 'Lesson details retrieved successfully', 200, getMeta(req as AuthenticatedRequest));
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
    successResponse(res, results, 'Search results retrieved successfully', 200, getMeta(req as AuthenticatedRequest));
  } catch (error) {
    next(error);
  }
};