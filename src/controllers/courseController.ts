import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Course from '../models/Course';
import { HttpError } from '../utils/httpError';
import redisClient from '../config/redis';
import { successResponse } from '../middleware/response';
import { getErrorMessage } from '../utils/errors';

// Extend req typing for authenticated routes
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
  };
}

/**
 * Delete all cached keys matching a prefix. Redis's DEL has no wildcard
 * support - `del('courses:*')` would only ever delete a literal key named
 * "courses:*", which never exists, so cache invalidation must scan first.
 */
const clearCachePattern = async (pattern: string): Promise<void> => {
  const keys = await redisClient.keys(pattern);
  if (keys.length > 0) {
    await redisClient.del(keys);
  }
};

export const listCourses = async (req: Request, res: Response) => {
  const { page = 1, limit = 10, sort, fields, search } = req.query;

  // Built dynamically from arbitrary query params, then passed straight to
  // Mongoose's find/countDocuments - modeling this against Mongoose's
  // FilterQuery<T> generics for a param bag whose keys aren't known ahead of
  // time isn't worth the complexity it'd add here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filters: Record<string, any> = { ...req.query };
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
        const parsedCache = JSON.parse(cachedCourses);
        return successResponse(res, parsedCache.data, 'Courses retrieved from cache');
      }
    }

    // Reassigned below through conditional .sort()/.select() chaining;
    // typing this against Mongoose's Query<> generics for a filter object
    // whose shape isn't known ahead of time isn't worth the complexity here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: mongoose.Query<any, any> = Course.find(filters);

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
    return successResponse(res, result, 'Courses retrieved successfully');
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
        const parsedCache = JSON.parse(cachedCourse);
        return successResponse(res, parsedCache.data, 'Course retrieved from cache');
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
    return successResponse(res, course, 'Course retrieved successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const createCourse = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, description, thumbnailUrl, price, syllabus, instructorId } = req.body;
    const currentUser = req.user;

    let finalInstructorId;

    if (currentUser!.role === 'admin') {
      if (!instructorId) {
        throw new HttpError(
          400,
          'Admin must specify an instructorId in the request body.',
          'INSTRUCTOR_ID_REQUIRED',
        );
      }
      finalInstructorId = instructorId;
    }
    if (currentUser!.role === 'instructor') {
      finalInstructorId = currentUser!.id;
    }

    const course = await Course.create({
      title,
      description,
      thumbnailUrl,
      price,
      syllabus,
      instructorId: finalInstructorId,
    });
    if (redisClient.isReady) {
      try {
        await clearCachePattern('courses:*');
      } catch (e) {
        console.error('Failed to clear course cache', e);
      }
    }
    successResponse(res, course, 'Course created successfully', 201);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', getErrorMessage(error, 'Unknown error'));
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
        await clearCachePattern('courses:*');
      } catch (e) {
        console.error('Failed to clear course cache', e);
      }
    }
    successResponse(res, course, 'Course updated successfully');
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
        await clearCachePattern('courses:*');
      } catch (e) {
        console.error('Failed to clear course cache', e);
      }
    }
    successResponse(res, [], 'Course deleted successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};
