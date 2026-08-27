import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import OakEnrollment from '../models/OakEnrollment';
import Progress from '../models/Progress';
import User from '../models/User';
import { HttpError } from '../utils/httpError';
import { PAID_SUBJECTS } from '../config/curriculum';
import { successResponse } from '../middleware/response';
import { isFreeUser, UserWithSubscription } from '../utils/subscriptionUtils';

interface AuthenticatedRequest extends Request {
  user?: UserWithSubscription;
}

/**
 * Get all enrollments and progress for the current user
 * GET /progress/my-progress
 */
export const getMyProgress = async (req: Request, res: Response, next: NextFunction) => {
  const { user } = req as AuthenticatedRequest;
  if (!user) {
    return next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
  }

  try {
    // Get all enrollments for this user
    const enrollments = await OakEnrollment.find({ userId: user.id }).sort({ lastAccessedAt: -1 });

    // Fetch progress for ALL enrollments in a single query (was one query per
    // enrollment via Promise.all - this endpoint is hit on every dashboard/
    // browse page load, so N+1 here means N+1 per concurrent user).
    const enrollmentIds = enrollments.map((e) => e._id);
    const allProgress = await Progress.find({ enrollmentId: { $in: enrollmentIds } });

    const progressByEnrollment = allProgress.reduce((map, record) => {
      const key = record.enrollmentId.toString();
      const existing = map.get(key);
      if (existing) {
        existing.push(record);
      } else {
        map.set(key, [record]);
      }
      return map;
    }, new Map<string, typeof allProgress>());

    const enrollmentsWithProgress = enrollments.map((enrollment) => {
      const progressRecords = progressByEnrollment.get(enrollment._id.toString()) || [];

      // Calculate overall progress
      const totalLessons = progressRecords.length;
      const completedLessons = progressRecords.filter((p) => p.status === 'completed').length;
      const progressPercent =
        totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      return {
        _id: enrollment._id,
        subjectSlug: enrollment.subjectSlug,
        keyStage: enrollment.keyStage,
        status: enrollment.status,
        startDate: enrollment.startDate,
        lastAccessedAt: enrollment.lastAccessedAt,
        progress: {
          totalLessons,
          completedLessons,
          progressPercent,
          lessons: progressRecords.map((p) => ({
            lessonSlug: p.lessonSlug,
            unitSlug: p.unitSlug,
            status: p.status,
            quizScore: p.quizScore,
            completedAt: p.completedAt,
          })),
        },
      };
    });

    return successResponse(res, enrollmentsWithProgress, 'Progress retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Enroll a user in an Oak National Academy subject/lesson
 * POST /progress/enroll
 */
export const enroll = async (req: Request, res: Response, next: NextFunction) => {
  const { user } = req as AuthenticatedRequest;
  if (!user) {
    return next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
  }

  const { lessonSlug, unitSlug, subjectSlug, keyStage } = req.body;

  // Validate keyStage enum
  const VALID_KEY_STAGES = ['ks1', 'ks2', 'ks3', 'ks4'];
  if (!VALID_KEY_STAGES.includes(keyStage)) {
    return next(
      new HttpError(
        400,
        `Invalid keyStage. Must be one of: ${VALID_KEY_STAGES.join(', ')}`,
        'INVALID_KEY_STAGE',
      ),
    );
  }

  // Freemium Check: paid subjects require an active subscription
  if (PAID_SUBJECTS.includes(subjectSlug)) {
    if (isFreeUser(user)) {
      return next(
        new HttpError(403, 'This content requires a premium subscription.', 'PREMIUM_REQUIRED'),
      );
    }
  }

  try {
    // Find or Create Enrollment (Subject Level)
    // Unique per { userId, subjectSlug, keyStage } — so KS1 English and KS2 English
    // are completely independent enrollments.
    let enrollment = await OakEnrollment.findOne({
      userId: user.id,
      subjectSlug,
      keyStage,
    });

    if (!enrollment) {
      try {
        enrollment = await OakEnrollment.create({
          userId: user.id,
          keyStage,
          subjectSlug,
          status: 'active',
          startDate: new Date(),
        });
      } catch (createErr) {
        // Handle race-condition duplicate key errors gracefully
        const isDuplicateKeyError =
          createErr instanceof Error && (createErr as Error & { code?: number }).code === 11000;
        if (isDuplicateKeyError) {
          // Another request already created the enrollment — fetch it
          enrollment = await OakEnrollment.findOne({ userId: user.id, subjectSlug, keyStage });
          if (!enrollment) {
            return next(
              new HttpError(
                500,
                'Failed to retrieve enrollment after conflict',
                'INTERNAL_SERVER_ERROR',
              ),
            );
          }
          await enrollment.updateLastAccessed();
        } else {
          return next(createErr);
        }
      }
    } else {
      // Update access time
      await enrollment.updateLastAccessed();
    }

    // 3. Find or Create Progress (Lesson Level)
    // Implicitly "start" the lesson upon enrollment call if lessonSlug is present
    if (lessonSlug && unitSlug) {
      const progress = await Progress.findOne({
        enrollmentId: enrollment._id,
        lessonSlug,
      });

      if (!progress) {
        await Progress.create({
          enrollmentId: enrollment._id,
          userId: user.id,
          unitSlug,
          lessonSlug,
          status: 'started',
        });
      }
    }

    return successResponse(res, enrollment, 'Enrolled successfully', 201);
  } catch (error) {
    return next(error);
  }
};

/**
 * Update progress for an enrollment (e.g. heartbeat, video watch)
 * PUT /progress/enrollments/:id/progress
 */
export const updateProgress = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params; // Enrollment ID
  const { lessonSlug, unitSlug } = req.body;

  // Note: videoWatchedPercent / slidesViewed are not currently stored in the Progress model,
  // but we accept them to simulate the heartbeat logic requested.

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new HttpError(400, 'Invalid enrollment ID', 'INVALID_ID');
    }

    const enrollment = await OakEnrollment.findById(id);
    if (!enrollment) {
      throw new HttpError(404, 'Enrollment not found', 'NOT_FOUND');
    }

    // Update enrollment access time
    await enrollment.updateLastAccessed();

    // If specific lesson details are provided, ensure a Progress record exists/is updated
    if (lessonSlug && unitSlug) {
      let progress = await Progress.findOne({
        enrollmentId: id,
        lessonSlug,
      });

      if (!progress) {
        progress = await Progress.create({
          enrollmentId: id,
          userId: enrollment.userId,
          unitSlug,
          lessonSlug,
          status: 'started',
        });
      }
      // In a real implementation, we would update granular fields here
    }

    successResponse(res, null, 'Progress updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Submit a quiz and record the result
 * POST /progress/enrollments/:id/quiz
 */
export const submitQuiz = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params; // Enrollment ID
  const { lessonSlug, unitSlug, answers } = req.body;
  // answers: [{ questionId: string, answer: string }]

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new HttpError(400, 'Invalid enrollment ID', 'INVALID_ID');
    }

    const enrollment = await OakEnrollment.findById(id);
    if (!enrollment) {
      throw new HttpError(404, 'Enrollment not found', 'NOT_FOUND');
    }

    await enrollment.updateLastAccessed();

    // Mock Scoring Logic
    // In a real app, fetch the quiz from Oak API or DB and compare answers.
    // Here, we simulate a score based on provided answers count or random for demo.
    // Let's assume passed if they provided answers.
    const calculatedScore = answers && answers.length > 0 ? 85 : 0; // Mock score

    // Find or Create Progress
    let progress = await Progress.findOne({
      enrollmentId: id,
      lessonSlug,
    });

    if (!progress) {
      progress = new Progress({
        enrollmentId: id,
        userId: enrollment.userId,
        unitSlug,
        lessonSlug,
        status: 'started',
      });
    }

    // Update Progress
    if (calculatedScore >= 80) {
      await progress.markCompleted(calculatedScore);
    } else {
      // Just update the score but keep as started/in-progress if failed?
      // Schema supports quizScore even if not completed, but markCompleted sets both.
      // We'll manually update if not completed.
      progress.quizScore = calculatedScore;
      await progress.save();
    }

    successResponse(
      res,
      {
        score: calculatedScore,
        passed: calculatedScore >= 80,
        status: progress.status,
      },
      'Quiz submitted successfully',
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to calculate streak from activity dates
 */
const calculateStreak = (activityDates: Date[]): number => {
  if (!activityDates || activityDates.length === 0) return 0;

  // Sort dates in descending order (most recent first)
  const sortedDates = activityDates
    .map((d) => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime());

  // Normalize to date-only strings for comparison
  const uniqueDays = [...new Set(sortedDates.map((d) => d.toISOString().split('T')[0]))];

  if (uniqueDays.length === 0) return 0;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Check if user was active today or yesterday (streak not broken)
  if (uniqueDays[0] !== today && uniqueDays[0] !== yesterday) {
    return 0; // Streak broken
  }

  let streak = 1;
  for (let i = 0; i < uniqueDays.length - 1; i += 1) {
    const current = new Date(uniqueDays[i]);
    const next = new Date(uniqueDays[i + 1]);
    const diffDays = Math.round((current.getTime() - next.getTime()) / 86400000);

    if (diffDays === 1) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
};

/**
 * Record user activity for streak tracking
 * POST /progress/activity
 */
export const recordActivity = async (req: Request, res: Response, next: NextFunction) => {
  const { user } = req as AuthenticatedRequest;
  if (!user) {
    return next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const userDoc = await User.findById(user.id);
    if (!userDoc) {
      return next(new HttpError(404, 'User not found', 'NOT_FOUND'));
    }

    // Check if we already recorded activity today
    const activityDates = userDoc.activityDates || [];
    const lastActivity =
      activityDates.length > 0 ? new Date(activityDates[activityDates.length - 1]) : null;
    const lastActivityDay = lastActivity ? lastActivity.toISOString().split('T')[0] : null;
    const todayStr = today.toISOString().split('T')[0];

    if (lastActivityDay !== todayStr) {
      // Add today to activity dates
      activityDates.push(new Date());

      // Keep only last 90 days of activity
      const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
      const recentDates = activityDates.filter((d) => new Date(d) >= ninetyDaysAgo);

      // Calculate new streak
      const newStreak = calculateStreak(recentDates);

      await User.findByIdAndUpdate(user.id, {
        lastActiveAt: new Date(),
        activityDates: recentDates,
        currentStreak: newStreak,
      });

      return successResponse(res, { streak: newStreak, recorded: true }, 'Activity recorded');
    }
    // Already recorded today
    return successResponse(
      res,
      { streak: userDoc.currentStreak || 0, recorded: false },
      'Activity already recorded today',
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * Get user's current streak
 * GET /progress/streak
 */
export const getStreak = async (req: Request, res: Response, next: NextFunction) => {
  const { user } = req as AuthenticatedRequest;
  if (!user) {
    return next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
  }

  try {
    const userDoc = await User.findById(user.id);
    if (!userDoc) {
      return next(new HttpError(404, 'User not found', 'NOT_FOUND'));
    }

    // Recalculate streak to ensure accuracy
    const activityDates = userDoc.activityDates || [];
    const currentStreak = calculateStreak(activityDates);

    // Update if different
    if (currentStreak !== userDoc.currentStreak) {
      await User.findByIdAndUpdate(user.id, { currentStreak });
    }

    return successResponse(
      res,
      {
        streak: currentStreak,
        lastActiveAt: userDoc.lastActiveAt,
      },
      'Streak retrieved',
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * Unenroll a user from an Oak subject at a specific key stage.
 * Cascades to delete all associated Progress records for that enrollment.
 * DELETE /progress/enroll
 */
export const unenroll = async (req: Request, res: Response, next: NextFunction) => {
  const { user } = req as AuthenticatedRequest;
  if (!user) {
    return next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
  }

  const { subjectSlug, keyStage } = req.body;

  if (!subjectSlug || !keyStage) {
    return next(new HttpError(400, 'subjectSlug and keyStage are required', 'VALIDATION_ERROR'));
  }

  try {
    const enrollment = await OakEnrollment.findOne({
      userId: user.id,
      subjectSlug,
      keyStage,
    });

    if (!enrollment) {
      return next(new HttpError(404, 'Enrollment not found', 'NOT_FOUND'));
    }

    // Cascade: delete all Progress records tied to this enrollment
    await Progress.deleteMany({ enrollmentId: enrollment._id });

    // Delete the enrollment itself
    await OakEnrollment.findByIdAndDelete(enrollment._id);

    return successResponse(res, null, `Unenrolled from ${keyStage} ${subjectSlug} successfully`);
  } catch (error) {
    return next(error);
  }
};
