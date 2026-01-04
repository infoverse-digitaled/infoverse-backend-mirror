import { Request, Response, NextFunction } from 'express';
import oakApiService from '../services/oakApiService';
import { successResponse } from '../middleware/response';
import { HttpError } from '../utils/httpError';
import { PAID_SUBJECTS, ALLOWED_SUBJECTS, BLOCKED_SUBJECTS } from '../config/curriculum';
import { isFreeUser as checkIsFreeUser, UserWithSubscription } from '../utils/subscriptionUtils';

// Extend Request to include user info from optionalAuth
interface AuthenticatedRequest extends Request {
  user?: UserWithSubscription & {
    name: string;
    email: string;
  };
}

/**
 * Check if user is a free user (uses unified utility)
 */
const isFreeUser = (req: AuthenticatedRequest): boolean => {
  return checkIsFreeUser(req.user);
};

/**
 * Get metadata for response (showAds for free users)
 */
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

    // Step 2: Filter out blocked subjects (safety filter)
    subjects = subjects.filter((subject) => !BLOCKED_SUBJECTS.includes(subject.slug));

    // Step 3: Lock paid subjects for free users
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
 * Note: With 14-day free trial, all users have access to all lessons during trial
 */
export const getLessons = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { unitSlug } = req.params;
    const lessons = await oakApiService.getLessons(unitSlug);

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
 * Get quiz questions for a lesson
 */
export const getLessonQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lessonSlug } = req.params;
    const quiz = await oakApiService.getLessonQuiz(lessonSlug);
    successResponse(res, quiz, 'Quiz retrieved successfully', 200, getMeta(req as AuthenticatedRequest));
  } catch (error) {
    next(error);
  }
};

/**
 * Get lesson assets (video, worksheets, slides)
 * Rewrites Oak API URLs to use our backend proxy
 */
export const getLessonAssets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lessonSlug } = req.params;
    // Get the base URL for our backend to rewrite asset URLs
    const protocol = req.protocol;
    const host = req.get('host');
    const backendBaseUrl = `${protocol}://${host}`;

    const assets = await oakApiService.getLessonAssets(lessonSlug, backendBaseUrl);
    successResponse(res, assets, 'Lesson assets retrieved successfully', 200, getMeta(req as AuthenticatedRequest));
  } catch (error) {
    next(error);
  }
};

/**
 * Stream/proxy a specific asset file (video, worksheet, etc.)
 * This proxies the request to Oak API with proper authentication
 * IMPORTANT: We set all CORS headers ourselves and DO NOT pass through Oak API headers
 */
export const getAssetFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lessonSlug, assetType } = req.params;

    const { stream, contentType, contentDisposition, contentLength } = await oakApiService.getAssetFile(lessonSlug, assetType);

    // CRITICAL: Set all CORS headers FIRST before any other headers
    // These must be set to allow cross-origin video playback
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Authorization, Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Set content type
    res.setHeader('Content-Type', contentType);

    // Set content length if available
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    // For video, enable streaming (no Content-Disposition) and range requests
    if (assetType === 'video') {
      res.setHeader('Accept-Ranges', 'bytes');
      // Enable cross-origin embedding for video elements
      res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
      // Cache video for performance
      res.setHeader('Cache-Control', 'public, max-age=3600');
      // Don't set Content-Disposition for videos - allow inline playback
    } else if (contentDisposition) {
      // For downloadable assets like worksheets, set Content-Disposition
      res.setHeader('Content-Disposition', contentDisposition);
    }

    // Pipe the stream directly to the response
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Get lesson transcript
 */
export const getLessonTranscript = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lessonSlug } = req.params;
    const transcript = await oakApiService.getLessonTranscript(lessonSlug);
    successResponse(res, transcript, 'Lesson transcript retrieved successfully', 200, getMeta(req as AuthenticatedRequest));
  } catch (error) {
    next(error);
  }
};

/**
 * Search lessons
 * Filters out paid subject content for free users
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

    let results = await oakApiService.searchLessons(q, filters);
    const freeUser = isFreeUser(req as AuthenticatedRequest);

    // Filter search results for free users
    if (freeUser && results && Array.isArray(results.data)) {
      // Filter out lessons from paid subjects
      results = {
        ...results,
        data: results.data.filter((lesson: any) => {
          const lessonSubject = lesson.subjectSlug || lesson.subject;
          return !PAID_SUBJECTS.includes(lessonSubject);
        }),
      };

      // Mark any remaining paid content as locked (if it slips through)
      results.data = results.data.map((lesson: any) => {
        const lessonSubject = lesson.subjectSlug || lesson.subject;
        if (PAID_SUBJECTS.includes(lessonSubject)) {
          return { ...lesson, locked: true };
        }
        return lesson;
      });
    }

    successResponse(res, results, 'Search results retrieved successfully', 200, getMeta(req as AuthenticatedRequest));
  } catch (error) {
    next(error);
  }
};