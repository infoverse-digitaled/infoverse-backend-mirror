import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Enrollment from '../models/Enrollment';
import Course from '../models/Course';
import { HttpError } from '../utils/httpError';
import { redisClient } from '../server';
import { emailQueue } from '../utils/emailQueue'; // Assuming you have a queue setup for sending emails

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
  const { courseId } = req.body;
  const userId = req.user!.id;

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

  // --- CHANGE STARTS HERE ---
  // Add a job to the queue to send a confirmation email
  if (req.user?.email) {
    // Check if user email exists
    await emailQueue.add('send-enrollment-confirmation', {
      email: req.user.email,
      name: req.user.name,
      courseTitle: course.title,
    });
    console.log(`Job added to queue for user ${req.user.email}`);
  }
  // --- CHANGE ENDS HERE ---

  if (redisClient.isReady) {
    try {
      await redisClient.del(`userEnrollments:${userId}`);
      await redisClient.del(`courseEnrollments:${courseId}`);
    } catch (e) {
      console.error('Failed to clear enrollment cache', e);
    }
  }
  res.status(201).json({
    message: 'Enrolled successfully! A confirmation email is being sent.',
    data: enrollment,
  });
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
        return res.status(200).json(JSON.parse(cachedEnrollments));
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
    res.status(200).json(response);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const updateEnrollmentStatus = async (req: Request, res: Response) => {
  const { enrollmentId } = req.params;
  const { status } = req.body;
  try {
    if (!mongoose.Types.ObjectId.isValid(enrollmentId)) {
      throw new HttpError(400, 'Invalid enrollment ID', 'INVALID_ID');
    }
    const enrollment = await Enrollment.findByIdAndUpdate(enrollmentId, { status }, { new: true });
    if (!enrollment) {
      throw new HttpError(404, 'Enrollment not found', 'NOT_FOUND');
    }

    if (redisClient.isReady) {
      try {
        await redisClient.del(`userEnrollments:${(enrollment as any).userId}`);
        await redisClient.del(`courseEnrollments:${(enrollment as any).courseId}`);
      } catch (e) {
        console.error('Failed to clear enrollment cache', e);
      }
    }
    res.status(200).json({ data: enrollment });
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
    res.status(200).json({ message: 'Successfully dropped course' });
  } catch (error) {
    if (error instanceof HttpError) {
      throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
    }
  }
};
