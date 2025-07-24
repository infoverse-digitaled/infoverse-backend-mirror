import { Request, Response } from 'express';
import { createClient } from 'redis';
import Course from '../models/Course';
import { HttpError } from '../utils/httpError';

const redisClient = createClient();
redisClient
  .connect()
  .then(() => {
    console.log('Connected to Redis');
  })
  .catch((err) => console.error('Redis connection error:', err));

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
  const course = await Course.findById(id);
  return course;
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
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  try {
    const cachedCourses = await redisClient.get(`courses:${page}:${limit}`);
    if (cachedCourses) {
      return res.status(200).json(JSON.parse(cachedCourses)); // Cached response
    }
    const result = await getPaginatedCourses(page, limit);
    await redisClient.setEx(`courses:${page}:${limit}`, 3600, JSON.stringify(result));
    res.status(200).json(result);
  } catch (error) {
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const getCourseById = async (req: Request, res: Response) => {
  try {
    const cachedCourse = await redisClient.get(`course:${req.params.id}`);
    if (cachedCourse) {
      return res.status(200).json(JSON.parse(cachedCourse)); // Cached response
    }
    const course = await findCourseById(req.params.id);
    await redisClient.setEx(`course:${req.params.id}`, 3600, JSON.stringify(course));
    res.status(200).json({ data: course });
    if (!course) {
      throw new HttpError(404, 'Course not found', 'NOT_FOUND');
    }
  } catch (error) {
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const createCourse = async (req: AuthenticatedRequest, res: Response) => {
  const course = await Course.create({ ...req.body, instructorId: req.user!.id });
  await redisClient.del('courses:*');
  res.status(201).json({ data: course });
};

export const updateCourse = async (req: AuthenticatedRequest, res: Response) => {
  const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!course) {
    throw new HttpError(404, 'Course not found', 'NOT_FOUND');
  }
  await redisClient.del(`course:${req.params.id}`);
  await redisClient.del('courses:*');
  res.status(200).json({ data: course });
};

export const deleteCourse = async (req: AuthenticatedRequest, res: Response) => {
  const course = await Course.findByIdAndDelete(req.params.id);
  if (!course) {
    throw new HttpError(404, 'Course not found', 'NOT_FOUND');
  }
  await redisClient.del(`course:${req.params.id}`);
  await redisClient.del('courses:*');
  res.status(200).json({ message: 'Course deleted' });
};
