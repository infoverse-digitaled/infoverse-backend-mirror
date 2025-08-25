import { Request, Response } from 'express';
import mongoose, { Query } from 'mongoose'; // <-- 1. Import the Query type
import Course from '../models/Course';
import { HttpError } from '../utils/httpError';
import { redisClient } from '../server';

// Extend req typing for authenticated routes
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
  };
}

export const listCourses = async (req: Request, res: Response) => {
  const { page = 1, limit = 10, sort, fields, search } = req.query;

  const filters: { [key: string]: any } = { ...req.query };
  delete filters.page;
  delete filters.limit;
  delete filters.sort;
  delete filters.fields;
  delete filters.search;

  if (search) {
    filters.$text = { $search: search as string };
  }

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  const cacheKey = `courses:page=${pageNum}&limit=${limitNum}&sort=${sort || ''}&fields=${fields || ''}&search=${search || ''}`;

  try {
    if (redisClient.isReady) {
      const cachedCourses = await redisClient.get(cacheKey);
      if (cachedCourses) {
        return res.status(200).json(JSON.parse(cachedCourses));
      }
    }

    let query: Query<any, any> = Course.find(filters);

    // Sorting Logic
    if (sort) {
      const sortBy = (sort as string).split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Field Limiting (Projection) Logic
    if (fields) {
      const fieldsList = (fields as string).split(',').join(' ');
      query = query.select(fieldsList);
    }

    query = query.skip(skip).limit(limitNum);

    const courses = await query;
    const totalRecords = await Course.countDocuments(filters);
    const totalPages = Math.ceil(totalRecords / limitNum);

    const result = {
      data: courses,
      pagination: {
        total_records: totalRecords,
        current_page: pageNum,
        total_pages: totalPages,
        next_page: pageNum < totalPages ? pageNum + 1 : null,
        prev_page: pageNum > 1 ? pageNum - 1 : null,
      },
    };

    if (redisClient.isReady) {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(result));
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

    const course = await Course.findById(id);
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
