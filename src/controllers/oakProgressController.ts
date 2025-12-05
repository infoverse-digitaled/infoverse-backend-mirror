import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import OakEnrollment from '../models/OakEnrollment';
import Progress from '../models/Progress';
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

    // Get progress for each enrollment
    const enrollmentsWithProgress = await Promise.all(
      enrollments.map(async (enrollment) => {
        const progressRecords = await Progress.find({ enrollmentId: enrollment._id });

        // Calculate overall progress
        const totalLessons = progressRecords.length;
        const completedLessons = progressRecords.filter(p => p.status === 'completed').length;
        const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

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
            lessons: progressRecords.map(p => ({
              lessonSlug: p.lessonSlug,
              unitSlug: p.unitSlug,
              status: p.status,
              quizScore: p.quizScore,
              completedAt: p.completedAt,
            })),
          },
        };
      })
    );

    successResponse(res, enrollmentsWithProgress, 'Progress retrieved successfully');
  } catch (error) {
    next(error);
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

  // 1. Validation: Freemium Check using unified utility
  if (PAID_SUBJECTS.includes(subjectSlug)) {
    if (isFreeUser(user)) {
      return next(
        new HttpError(
          403,
          'This content requires a premium subscription.',
          'PREMIUM_REQUIRED'
        )
      );
    }
  }

  try {
    // 2. Find or Create Enrollment (Subject Level)
    let enrollment = await OakEnrollment.findOne({
      userId: user.id,
      subjectSlug,
      keyStage,
    });

    if (!enrollment) {
      enrollment = await OakEnrollment.create({
        userId: user.id,
        keyStage,
        subjectSlug,
        status: 'active',
        startDate: new Date(),
      });
    } else {
      // Update access time
      await enrollment.updateLastAccessed();
    }

    // 3. Find or Create Progress (Lesson Level)
    // We implicitly "start" the lesson upon enrollment call if lessonSlug is present
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

    successResponse(res, enrollment, 'Enrolled successfully', 201);
  } catch (error) {
    next(error);
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
            lessonSlug
        });

        if (!progress) {
             progress = await Progress.create({
                enrollmentId: id,
                userId: enrollment.userId,
                unitSlug,
                lessonSlug,
                status: 'started'
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

    successResponse(res, {
        score: calculatedScore,
        passed: calculatedScore >= 80,
        status: progress.status
    }, 'Quiz submitted successfully');

  } catch (error) {
    next(error);
  }
};
