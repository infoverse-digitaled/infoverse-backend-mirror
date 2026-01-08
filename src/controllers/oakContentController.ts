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
 * Redirect to Oak API asset directly
 * Instead of proxying (which causes timeout issues), we redirect to Oak API
 * with a signed URL that includes our API key
 */
export const getAssetFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lessonSlug, assetType } = req.params;

    // Build the Oak API URL
    const oakApiKey = process.env.OAK_API_KEY;
    const oakBaseUrl = process.env.OAK_API_BASE_URL || 'https://open-api.thenational.academy/api/v0';
    const assetUrl = `${oakBaseUrl}/lessons/${lessonSlug}/assets/${assetType}`;

    // CORS headers for the redirect response
    const requestOrigin = req.headers.origin || 'https://infoversedigitaleducation.net';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Authorization, Content-Type');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // For browsers that can't follow redirects with custom headers (video/download),
    // we need to proxy. For others, we could redirect.
    // Since video elements can't add Authorization headers, we MUST proxy.

    const { stream, contentType, contentDisposition, contentLength } = await oakApiService.getAssetFile(lessonSlug, assetType);

    // Set content type
    res.setHeader('Content-Type', contentType);

    // Set content length if available
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    // For video, enable streaming and range requests
    if (assetType === 'video') {
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
      res.setHeader('Cache-Control', 'public, max-age=3600');
    } else if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    }

    // Add error handlers before piping
    stream.on('error', (err: Error) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream failed', message: err.message });
      }
    });
    res.on('error', (err: Error) => {
      console.error('Response error:', err);
      stream.destroy();
    });

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
 * Clear cache for a specific key stage and subject (Admin only)
 * Used to fix issues with stale/corrupted cache data
 */
export const clearSubjectCache = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { keyStage, subjectSlug } = req.params;

    if (!keyStage || !subjectSlug) {
      return res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'keyStage and subjectSlug are required' },
      });
    }

    const deletedCount = await oakApiService.clearSubjectCache(keyStage, subjectSlug);

    successResponse(
      res,
      { deletedCount, keyStage, subjectSlug },
      `Cache cleared for ${keyStage}/${subjectSlug}. ${deletedCount} keys deleted.`,
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Clear all cache for a key stage (Admin only)
 */
export const clearKeyStageCache = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { keyStage } = req.params;

    if (!keyStage) {
      return res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'keyStage is required' },
      });
    }

    const deletedCount = await oakApiService.clearKeyStageCache(keyStage);

    successResponse(
      res,
      { deletedCount, keyStage },
      `Cache cleared for ${keyStage}. ${deletedCount} keys deleted.`,
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Clear all Oak API cache (Admin only)
 */
export const clearAllCache = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deletedCount = await oakApiService.clearCache('');

    successResponse(
      res,
      { deletedCount },
      `All Oak API cache cleared. ${deletedCount} keys deleted.`,
      200
    );
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

    // RELIABILITY FIX: Add bounds checking on pagination
    const parsedPage = Math.max(parseInt(page as string, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit as string, 10) || 20, 1), 100);

    const filters = {
      keyStage: keyStage as string,
      subjectSlug: subject as string,
      yearSlug: year as string,
      page: parsedPage,
      limit: parsedLimit,
    };

    let results = await oakApiService.searchLessons(q, filters);
    const freeUser = isFreeUser(req as AuthenticatedRequest);

    // Filter search results for free users
    if (freeUser && results && Array.isArray(results.data)) {
      // Filter out lessons from paid subjects
      // RELIABILITY FIX: Handle missing subject fields
      results = {
        ...results,
        data: results.data.filter((lesson: any) => {
          const lessonSubject = lesson.subjectSlug || lesson.subject || '';
          // Block if subject is unknown (could be paid content)
          if (!lessonSubject) return false;
          return !PAID_SUBJECTS.includes(lessonSubject);
        }),
      };

      // Mark any remaining paid content as locked (if it slips through)
      results.data = results.data.map((lesson: any) => {
        const lessonSubject = lesson.subjectSlug || lesson.subject || '';
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