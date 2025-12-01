import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import redisClient from '../../config/redis';
import User from '../../models/User';
import Course from '../../models/Course';
import { HttpError } from '../../utils/httpError';
import { successResponse } from '../../middleware/response';

export const getAllUsers = async (_req: Request, res: Response) => {
  try {
    if ((redisClient as any).status === 'ready') {
      const cachedUsers = await redisClient.get('users');
      if (cachedUsers) {
        const parsedCache = JSON.parse(cachedUsers);
        return successResponse(res, parsedCache.data, 'Users retrieved from cache');
      }
    }

    const users = await User.find();
    if ((redisClient as any).status === 'ready') {
      await redisClient.setEx('users', 3600, JSON.stringify({ data: users }));
    }
    successResponse(res, users, 'Users retrieved successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    if ((redisClient as any).status === 'ready') {
      const cachedUser = await redisClient.get(`user:${req.params.id}`);
      if (cachedUser) {
        const parsedCache = JSON.parse(cachedUser);
        return successResponse(res, parsedCache.data, 'User retrieved from cache');
      }
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new HttpError(404, 'User not found', 'NOT_FOUND');
    }
    if ((redisClient as any).status === 'ready') {
      await redisClient.setEx(`user:${req.params.id}`, 3600, JSON.stringify({ data: user }));
    }
    successResponse(res, user, 'User retrieved successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new HttpError(400, 'EMAIL_EXISTS', 'Email already in use');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, role });
    successResponse(res, user, 'User created successfully', 201);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      throw new HttpError(404, 'User not found', 'NOT_FOUND');
    }
    successResponse(res, [], 'User deleted successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { password, ...otherFields } = req.body;
    if (password) {
      otherFields.passwordHash = await bcrypt.hash(password, 10);
    }
    if (otherFields.email) {
      const existingUser = await User.findOne({
        email: otherFields.email,
        _id: { $ne: req.params.id },
      });
      if (existingUser) {
        throw new HttpError(400, 'EMAIL_EXISTS', 'Email already in use');
      }
    }

    const user = await User.findByIdAndUpdate(req.params.id, otherFields, { new: true });
    if (!user) {
      throw new HttpError(404, 'User not found', 'NOT_FOUND');
    }

    if ((redisClient as any).status === 'ready') {
      await redisClient.del(`user:${req.params.id}`);
      await redisClient.del('users');
    }
    successResponse(res, user, 'User updated successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

