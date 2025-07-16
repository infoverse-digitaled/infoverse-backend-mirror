import { Request, Response } from 'express';
import Course from '../models/Course';
import { HttpError } from '../utils/httpError';

// Internal helpers
const getPaginatedCourses = async (page: number, limit: number) => {
  const skip = (page - 1) * limit;
  const total = await Course.countDocuments();
  const data = await Course.find().skip(skip).limit(limit);

  return {
    data,
    pagination: {
      total_records: total,
      current_page: page,
      total_pages: Math.ceil(total / limit),
      next_page: page * limit < total ? page + 1 : null,
      prev_page: page > 1 ? page - 1 : null,
    },
  };
};

const findCourseById = async (id: string) => {
  return await Course.findById(id);
};

// Extend req typing for authenticated routes
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
  };
}

// Controllers
export const listCourses = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  const result = await getPaginatedCourses(page, limit);
  res.status(200).json(result);
};

export const getCourseById = async (req: Request, res: Response) => {
  const course = await findCourseById(req.params.id);
  if (!course) {
    throw new HttpError(404, 'Course not found', 'NOT_FOUND');
  }
  res.status(200).json({ data: course });
};

export const createCourse = async (req: AuthenticatedRequest, res: Response) => {
  const course = await Course.create({ ...req.body, instructorId: req.user!.id });
  res.status(201).json({ data: course });
};

export const updateCourse = async (req: AuthenticatedRequest, res: Response) => {
  const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!course) {
    throw new HttpError(404, 'Course not found', 'NOT_FOUND');
  }
  res.status(200).json({ data: course });
};

export const deleteCourse = async (req: AuthenticatedRequest, res: Response) => {
  const course = await Course.findByIdAndDelete(req.params.id);
  if (!course) {
    throw new HttpError(404, 'Course not found', 'NOT_FOUND');
  }
  res.status(200).json({ message: 'Course deleted' });
};
