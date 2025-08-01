import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Course from '../models/Course';
import { HttpError } from '../utils/httpError';
import { redisClient } from '../server';

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
  const cacheKey = `courses:${page}:${limit}`;

  try {
    if (redisClient.isReady) {
      const cachedCourses = await redisClient.get(cacheKey);
      if (cachedCourses) {
        return res.status(200).json(JSON.parse(cachedCourses));
      }
    }

    const result = await getPaginatedCourses(page, limit);

    if (redisClient.isReady) {
      try {
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(result));
      } catch (e) {
        console.error('Failed to cache courses', e);
      }
    }
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const getCourseById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const cacheKey = `course:${id}`;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new HttpError(400, 'Invalid course ID', 'INVALID_ID');
  }
  try {
    if (redisClient.isReady) {
      const cachedCourse = await redisClient.get(cacheKey);
      if (cachedCourse) {
        return res.status(200).json(JSON.parse(cachedCourse));
      }
    }

    const course = await findCourseById(id);
    if (!course) {
      throw new HttpError(404, 'Course not found', 'NOT_FOUND');
    }

    const response = { data: course };
    if (redisClient.isReady) {
      try {
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(response));
      } catch (e) {
        console.error('Failed to cache course', e);
      }
    }
    res.status(200).json(response);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const createCourse = async (req: AuthenticatedRequest, res: Response) => {
  const instructorId = req.user!.id;
  if (!mongoose.Types.ObjectId.isValid(instructorId)) {
    throw new HttpError(400, 'Invalid instructor ID', 'INVALID_ID');
  }
  try {
    const course = await Course.create({ ...req.body, instructorId: req.user!.id });
    if (redisClient.isReady) {
      try {
        await redisClient.del('courses:*');
      } catch (e) {
        console.error('Failed to clear course cache', e);
      }
    }
    res.status(201).json({ data: course });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const updateCourse = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new HttpError(400, 'Invalid ID', 'INVALID_ID');
    }
    if (!course) {
      throw new HttpError(404, 'Course not found', 'NOT_FOUND');
    }
    if (redisClient.isReady) {
      try {
        await redisClient.del(`course:${req.params.id}`);
        await redisClient.del('courses:*');
      } catch (e) {
        console.error('Failed to clear course cache', e);
      }
    }
    res.status(200).json({ data: course });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const deleteCourse = async (req: AuthenticatedRequest, res: Response) => {
  const courseId = req.params.id;
  try {
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      throw new HttpError(400, 'Invalid ID', 'INVALID_ID');
    }
    const course = await Course.findByIdAndDelete(courseId);
    if (!course) {
      throw new HttpError(404, 'Course not found', 'NOT_FOUND');
    }
    if (redisClient.isReady) {
      try {
        await redisClient.del(`course:${req.params.id}`);
        await redisClient.del('courses:*');
      } catch (e) {
        console.error('Failed to clear course cache', e);
      }
    }
    res.status(200).json({ message: 'Course deleted' });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};
