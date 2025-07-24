import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import Enrollment from '../models/Enrollment';
import Course from '../models/Course';
import { HttpError } from '../utils/httpError';

const redisClient = createClient();
redisClient
  .connect()
  .then(() => {
    console.log('Connected to Redis');
  })
  .catch((err) => console.error('Redis connection error:', err));

// Extend req typing for authenticated routes
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
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
  await redisClient.del(`userEnrollments:${userId}`);
  await redisClient.del(`courseEnrollments:${courseId}`);
  res.status(201).json({ message: 'Enrolled successfully', data: enrollment });
};

export const getUserEnrollments = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const cachedEnrollments = await redisClient.get(`userEnrollments:${userId}`);
  if (cachedEnrollments) {
    return res.status(200).json(JSON.parse(cachedEnrollments));
  }

  const enrollments = await Enrollment.find({ userId }).populate('courseId');
  await redisClient.setEx(`userEnrollments:${userId}`, 3600, JSON.stringify({ data: enrollments }));
  res.status(200).json({ data: enrollments });
};

export const getCourseEnrollments = async (req: Request, res: Response) => {
  const { courseId } = req.params;
  const cachedEnrollments = await redisClient.get(`courseEnrollments:${courseId}`);
  if (cachedEnrollments) {
    return res.status(200).json(JSON.parse(cachedEnrollments));
  }

  const enrollments = await Enrollment.find({ courseId }).populate('userId');
  await redisClient.setEx(
    `courseEnrollments:${courseId}`,
    3600,
    JSON.stringify({ data: enrollments }),
  );
  res.status(200).json({ data: enrollments });
};

export const updateEnrollmentStatus = async (req: Request, res: Response) => {
  const { enrollmentId } = req.params;
  const { status } = req.body;

  const enrollment = await Enrollment.findByIdAndUpdate(enrollmentId, { status }, { new: true });
  if (!enrollment) {
    throw new HttpError(404, 'Enrollment not found', 'NOT_FOUND');
  }

  await redisClient.del(`userEnrollments:${(enrollment as any).userId}`);
  await redisClient.del(`courseEnrollments:${(enrollment as any).courseId}`);
  res.status(200).json({ data: enrollment });
};

export const dropCourse = async (req: AuthenticatedRequest, res: Response) => {
  const { courseId } = req.params;
  const userId = req.user!.id;

  const enrollment = await Enrollment.findOneAndDelete({ userId, courseId });
  if (!enrollment) {
    throw new HttpError(404, 'Enrollment not found', 'NOT_FOUND');
  }

  await redisClient.del(`userEnrollments:${userId}`);
  await redisClient.del(`courseEnrollments:${courseId}`);
  res.status(200).json({ message: 'Successfully dropped course' });
};
