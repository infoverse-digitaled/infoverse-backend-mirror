import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Enrollment from '../models/Enrollment';
import Course from '../models/Course';
import { HttpError } from '../utils/httpError';
import redisClient from '../config/redis';
import { emailQueue } from '../utils/emailQueue'; // Assuming you have a queue setup for sending emails
import { successResponse } from '../middleware/response';

// Extend req typing for authenticated routes
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
    name?: string; // Assuming name is available on the user object
  };
}

export const enrollInCourse = async (req: AuthenticatedRequest, res: Response) => {
  const { courseId } = req.params;
  const userId = req.user!.id;

  try {
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      throw new HttpError(400, 'Invalid course ID', 'INVALID_ID');
    }

    const course = await Course.findById(courseId);
    if (!course) {
      throw new HttpError(404, 'Course not found', 'NOT_FOUND');
    }

    const existingEnrollment = await Enrollment.findOne({ userId, courseId });
    if (existingEnrollment) {
      throw new HttpError(400, 'User already enrolled in this course', 'ALREADY_ENROLLED');
    }

    const enrollment = await Enrollment.create({ userId, courseId });

    // Add a job to the queue to send a confirmation email
    if (req.user?.email) {
      try {
        await emailQueue.add('send-enrollment-confirmation', {
          email: req.user.email,
          name: req.user.name,
          courseTitle: course.title,
        });
        console.log(`Job added to queue for user ${req.user.email}`);
      } catch (emailErr) {
        // Email queue failure should not block enrollment
        console.error('Failed to queue enrollment confirmation email', emailErr);
      }
    }

    if (redisClient.isReady) {
      try {
        await redisClient.del(`userEnrollments:${userId}`);
        await redisClient.del(`courseEnrollments:${courseId}`);
      } catch (e) {
        console.error('Failed to clear enrollment cache', e);
      }
    }
    successResponse(
      res,
      enrollment,
      'Enrolled successfully! A confirmation email is being sent.',
      201,
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const getCourseEnrollments = async (req: Request, res: Response) => {
  const { courseId } = req.params;
  const cacheKey = `courseEnrollments:${courseId}`;

  try {
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      throw new HttpError(400, 'Invalid course ID', 'INVALID_ID');
    }
    if (redisClient.isReady) {
      const cachedEnrollments = await redisClient.get(cacheKey);
      if (cachedEnrollments) {
        const parsedCache = JSON.parse(cachedEnrollments);
        return successResponse(res, parsedCache.data, 'Enrollments retrieved from cache');
      }
    }

    const enrollments = await Enrollment.find({ courseId }).populate('userId');
    const response = { data: enrollments };

    if (redisClient.isReady) {
      try {
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(response));
      } catch (e) {
        console.error('Failed to cache course enrollments', e);
      }
    }
    return successResponse(res, enrollments, 'Enrollments retrieved successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const updateEnrollmentStatus = async (req: Request, res: Response) => {
  const { enrollmentId } = req.params;
  const { courseId } = req.params;
  const { status } = req.body;
  try {
    if (!mongoose.Types.ObjectId.isValid(enrollmentId)) {
      throw new HttpError(400, 'Invalid enrollment ID', 'INVALID_ID');
    }
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      throw new HttpError(400, 'Invalid course ID', 'INVALID_ID');
    }
    const enrollment = await Enrollment.findByIdAndUpdate(enrollmentId, { status }, { new: true });
    if (!enrollment) {
      throw new HttpError(404, 'Enrollment not found', 'NOT_FOUND');
    }

    if (redisClient.isReady) {
      try {
        await redisClient.del(`userEnrollments:${enrollment.userId}`);
        await redisClient.del(`courseEnrollments:${enrollment.courseId}`);
      } catch (e) {
        console.error('Failed to clear enrollment cache', e);
      }
    }
    successResponse(res, enrollment, 'Enrollment status updated successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const dropCourse = async (req: AuthenticatedRequest, res: Response) => {
  const { courseId } = req.params;
  const userId = req.user!.id;
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new HttpError(400, 'Invalid user ID', 'INVALID_ID');
    }
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      throw new HttpError(400, 'Invalid course ID', 'INVALID_ID');
    }
    const enrollment = await Enrollment.findOneAndDelete({ userId, courseId });
    if (!enrollment) {
      throw new HttpError(404, 'Enrollment not found', 'NOT_FOUND');
    }

    if (redisClient.isReady) {
      try {
        await redisClient.del(`userEnrollments:${userId}`);
        await redisClient.del(`courseEnrollments:${courseId}`);
      } catch (e) {
        console.error('Failed to clear enrollment cache', e);
      }
    }
    successResponse(res, [], 'Successfully dropped course');
  } catch (error) {
    if (error instanceof HttpError) throw error; // Re-throw HttpErrors as-is (404, 400, etc.)
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

/**
 * Get the check-enrollment status for a specific user + course pair.
 * Used by the frontend to know if the current user is enrolled in a given course.
 * GET /api/v1/courses/:courseId/enrollment-status  (authenticated)
 */
export const getEnrollmentStatus = async (req: AuthenticatedRequest, res: Response) => {
  const { courseId } = req.params;
  const userId = req.user!.id;

  try {
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      throw new HttpError(400, 'Invalid course ID', 'INVALID_ID');
    }

    const enrollment = await Enrollment.findOne({ userId, courseId });

    successResponse(
      res,
      {
        enrolled: !!enrollment,
        enrollment: enrollment || null,
      },
      'Enrollment status retrieved successfully',
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

/**
 * Admin: Get all enrollments for a specific user by userId param.
 * GET /api/v1/admin/enrollments/user/:userId
 */
export const getUserEnrollments = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const cacheKey = `userEnrollments:${userId}`;

  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new HttpError(400, 'Invalid user ID', 'INVALID_ID');
    }

    if (redisClient.isReady) {
      const cachedEnrollments = await redisClient.get(cacheKey);
      if (cachedEnrollments) {
        const parsedCache = JSON.parse(cachedEnrollments);
        return successResponse(res, parsedCache.data, 'Enrollments retrieved from cache');
      }
    }

    const enrollments = await Enrollment.find({ userId }).populate('courseId');
    const response = { data: enrollments };

    if (redisClient.isReady) {
      try {
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(response));
      } catch (e) {
        console.error('Failed to cache user enrollments', e);
      }
    }
    return successResponse(res, enrollments, 'Enrollments retrieved successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};
