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
    successResponse(
      res,
      keyStages,
      'Key stages retrieved successfully',
      200,
      getMeta(req as AuthenticatedRequest),
    );
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
    let subjects = await oakApiService.getSubjectsByKeyStage(keyStage);

    // Step 1: Filter subjects to only those allowed for this key stage
    const allowedSubjectsForKeyStage = ALLOWED_SUBJECTS[keyStage] || [];
    subjects = subjects.filter((subject) => allowedSubjectsForKeyStage.includes(subject.slug));

    // Step 2: Filter out blocked subjects (safety filter)
    subjects = subjects.filter((subject) => !BLOCKED_SUBJECTS.includes(subject.slug));

    // Step 3: Lock paid subjects for free users
    const freeUser = isFreeUser(req as AuthenticatedRequest);
    if (freeUser) {
      subjects = subjects.map((subject) =>
        PAID_SUBJECTS.includes(subject.slug) ? { ...subject, locked: true } : subject,
      );
    }

    successResponse(
      res,
      subjects,
      'Subjects retrieved successfully',
      200,
      getMeta(req as AuthenticatedRequest),
    );
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
    successResponse(
      res,
      units,
      'Units retrieved successfully',
      200,
      getMeta(req as AuthenticatedRequest),
    );
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
    successResponse(
      res,
      unit,
      'Unit details retrieved successfully',
      200,
      getMeta(req as AuthenticatedRequest),
    );
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
    let lessons = await oakApiService.getLessons(unitSlug);

    // Lock lessons on paid subjects for free users, mirroring getSubjects.
    if (isFreeUser(req as AuthenticatedRequest)) {
      lessons = lessons.map((lesson) =>
        PAID_SUBJECTS.includes(lesson.subjectSlug) ? { ...lesson, locked: true } : lesson,
      );
    }

    successResponse(
      res,
      lessons,
      'Lessons retrieved successfully',
      200,
      getMeta(req as AuthenticatedRequest),
    );
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
    successResponse(
      res,
      lessonDetails,
      'Lesson details retrieved successfully',
      200,
      getMeta(req as AuthenticatedRequest),
    );
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
    successResponse(
      res,
      quiz,
      'Quiz retrieved successfully',
      200,
      getMeta(req as AuthenticatedRequest),
    );
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
    const { protocol } = req;
    const host = req.get('host');
    const backendBaseUrl = `${protocol}://${host}`;

    const assets = await oakApiService.getLessonAssets(lessonSlug, backendBaseUrl);
    successResponse(
      res,
      assets,
      'Lesson assets retrieved successfully',
      200,
      getMeta(req as AuthenticatedRequest),
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Serve lesson assets.
 * - VIDEO: issues a 302 redirect to the Oak API CDN URL directly.
 *   This completely avoids routing video data through GCP (which has a 32MB limit).
 *   The Oak API CDN is public/authenticated at the URL level so no extra headers are needed.
 * - OTHER ASSETS (PDF, slides, etc.): proxied through the backend as before.
 */
export const getAssetFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lessonSlug, assetType } = req.params;

    // CORS headers
    const requestOrigin = req.headers.origin || 'https://infoversedigitaleducation.net';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Authorization, Content-Type');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    // GCP FIX: Cap all video range requests so no single response exceeds 8MB.
    // GCP Cloud Run kills responses > 32MB. Videos are 60-100MB+.
    //
    // Browsers send open-ended ranges like 'bytes=0-' or 'bytes=8388608-'
    // meaning "give me everything from byte X onwards" — Oak API obliges with the full
    // remaining file which blows through the 32MB cap. We intercept all open-ended
    // ranges and cap them to 8MB chunks (safe buffer below 32MB, ~45-60s of video).
    // Specific ranges (e.g. 'bytes=4000000-5000000') pass through unchanged.
    const rawRange = req.headers.range;
    let range: string | undefined = rawRange;
    if (assetType === 'video') {
      const openEnded = rawRange?.match(/^bytes=(\d+)-$/); // e.g. 'bytes=0-' or 'bytes=8388608-'
      if (!rawRange || openEnded) {
        const start = openEnded ? parseInt(openEnded[1], 10) : 0;
        const end = start + 8388607; // 8MB chunk (8 * 1024 * 1024 - 1)
        range = `bytes=${start}-${end}`;
      }
      // else: specific range (bytes=X-Y) — pass through as-is
    }

    const { stream, contentType, contentDisposition, contentLength, contentRange, status } =
      await oakApiService.getAssetFile(lessonSlug, assetType, range);

    res.status(status || 200);
    res.setHeader('Content-Type', contentType);

    // Always set Content-Length for video chunks (they're small — Oak API returns the chunk size)
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);
    if (contentDisposition) res.setHeader('Content-Disposition', contentDisposition);

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');

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
    successResponse(
      res,
      transcript,
      'Lesson transcript retrieved successfully',
      200,
      getMeta(req as AuthenticatedRequest),
    );
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

    return successResponse(
      res,
      { deletedCount, keyStage, subjectSlug },
      `Cache cleared for ${keyStage}/${subjectSlug}. ${deletedCount} keys deleted.`,
      200,
    );
  } catch (error) {
    return next(error);
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

    return successResponse(
      res,
      { deletedCount, keyStage },
      `Cache cleared for ${keyStage}. ${deletedCount} keys deleted.`,
      200,
    );
  } catch (error) {
    return next(error);
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
      200,
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
        data: results.data.filter((lesson) => {
          const lessonSubject =
            lesson.subjectSlug || (lesson as { subject?: string }).subject || '';
          // Block if subject is unknown (could be paid content)
          if (!lessonSubject) return false;
          return !PAID_SUBJECTS.includes(lessonSubject);
        }),
      };

      // Mark any remaining paid content as locked (if it slips through)
      results.data = results.data.map((lesson) => {
        const lessonSubject = lesson.subjectSlug || (lesson as { subject?: string }).subject || '';
        if (PAID_SUBJECTS.includes(lessonSubject)) {
          return { ...lesson, locked: true };
        }
        return lesson;
      });
    }

    successResponse(
      res,
      results,
      'Search results retrieved successfully',
      200,
      getMeta(req as AuthenticatedRequest),
    );
  } catch (error) {
    next(error);
  }
};
