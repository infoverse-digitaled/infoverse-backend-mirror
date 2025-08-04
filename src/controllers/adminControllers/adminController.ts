import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { redisClient } from '../../server';
import User from '../../models/User';
import Course from '../../models/Course';
import { HttpError } from '../../utils/httpError';

export const getAllUsers = async (_req: Request, res: Response) => {
  try {
    if (redisClient.isReady) {
      const cachedUsers = await redisClient.get('users');
      if (cachedUsers) {
        return res.status(200).json(JSON.parse(cachedUsers));
      }
    }

    const users = await User.find();
    if (redisClient.isReady) {
      await redisClient.setEx('users', 3600, JSON.stringify(users));
    }
    res.status(200).json({ data: users });
  } catch (error) {
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    if (redisClient.isReady) {
      const cachedUser = await redisClient.get(`user:${req.params.id}`);
      if (cachedUser) {
        res.status(200).json(cachedUser);
      }
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new HttpError(404, 'User not found', 'NOT_FOUND');
    }
    res.status(200).json({ data: user });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password, and role are required.' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new HttpError(400, 'EMAIL_EXISTS', 'Email already in use');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, role });
    res.status(201).json({ message: 'User created successfully', data: user });
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
    res.status(200).json({ message: 'User deleted' });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const getAllCourses = async (_req: Request, res: Response) => {
  try {
    const courses = await Course.find();
    res.status(200).json({ data: courses });
  } catch (error) {
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const deleteCourse = async (req: Request, res: Response) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) {
      throw new HttpError(404, 'Course not found', 'NOT_FOUND');
    }
    res.status(200).json({ message: 'Course deleted' });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};
