import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Enrollment from '../models/Enrollment';
import Course from '../models/Course';
import { HttpError } from '../utils/httpError';

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
  res.status(201).json({ message: 'Enrolled successfully', data: enrollment });
};

export const getUserEnrollments = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const enrollments = await Enrollment.find({ userId }).populate('courseId');
  res.status(200).json({ data: enrollments });
};

export const getCourseEnrollments = async (req: Request, res: Response) => {
  const { courseId } = req.params;
  const enrollments = await Enrollment.find({ courseId }).populate('userId');
  res.status(200).json({ data: enrollments });
};

export const updateEnrollmentStatus = async (req: Request, res: Response) => {
  const { enrollmentId } = req.params;
  const { status } = req.body;

  const enrollment = await Enrollment.findByIdAndUpdate(enrollmentId, { status }, { new: true });
  if (!enrollment) {
    throw new HttpError(404, 'Enrollment not found', 'NOT_FOUND');
  }

  res.status(200).json({ data: enrollment });
};

export const dropCourse = async (req: AuthenticatedRequest, res: Response) => {
  const { courseId } = req.params;
  const userId = req.user!.id;

  const enrollment = await Enrollment.findOneAndDelete({ userId, courseId });
  if (!enrollment) {
    throw new HttpError(404, 'Enrollment not found', 'NOT_FOUND');
  }

  res.status(200).json({ message: 'Successfully dropped course' });
};
