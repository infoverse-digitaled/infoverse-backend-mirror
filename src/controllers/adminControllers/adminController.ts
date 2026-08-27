import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import redisClient from '../../config/redis';
import User from '../../models/User';
import Course from '../../models/Course';
import LicenseBatch, { generateLicenseKey } from '../../models/LicenseBatch';
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

// License Management Functions

/**
 * Create a new license batch for a school
 * POST /api/v1/admin/licenses
 */
export const createLicenseBatch = async (req: Request, res: Response) => {
  try {
    const { schoolName, maxUsers, expiryDate } = req.body;

    if (!schoolName || !maxUsers || !expiryDate) {
      throw new HttpError(
        400,
        'MISSING_FIELDS',
        'schoolName, maxUsers, and expiryDate are required.',
      );
    }

    if (maxUsers < 1) {
      throw new HttpError(400, 'INVALID_MAX_USERS', 'maxUsers must be at least 1.');
    }

    const parsedExpiryDate = new Date(expiryDate);
    if (isNaN(parsedExpiryDate.getTime()) || parsedExpiryDate <= new Date()) {
      throw new HttpError(400, 'INVALID_EXPIRY_DATE', 'expiryDate must be a valid future date.');
    }

    // Generate a unique license key
    let licenseKey = generateLicenseKey();
    let attempts = 0;
    while ((await LicenseBatch.findOne({ licenseKey })) && attempts < 10) {
      licenseKey = generateLicenseKey();
      attempts++;
    }

    if (attempts >= 10) {
      throw new HttpError(
        500,
        'LICENSE_GENERATION_FAILED',
        'Failed to generate unique license key.',
      );
    }

    const license = await LicenseBatch.create({
      schoolName,
      licenseKey,
      maxUsers,
      expiryDate: parsedExpiryDate,
    });

    successResponse(res, license, 'License batch created successfully', 201);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

/**
 * Get all license batches with usage stats
 * GET /api/v1/admin/licenses
 */
export const getAllLicenses = async (_req: Request, res: Response) => {
  try {
    const licenses = await LicenseBatch.find().sort({ createdAt: -1 });

    // Calculate usage stats
    const stats = {
      totalLicenses: licenses.length,
      activeLicenses: licenses.filter((l) => l.isActive && new Date(l.expiryDate) > new Date())
        .length,
      totalSeats: licenses.reduce((acc, l) => acc + l.maxUsers, 0),
      usedSeats: licenses.reduce((acc, l) => acc + l.enrolledCount, 0),
    };

    successResponse(res, { licenses, stats }, 'Licenses retrieved successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

/**
 * Get a single license by ID
 * GET /api/v1/admin/licenses/:id
 */
export const getLicenseById = async (req: Request, res: Response) => {
  try {
    const license = await LicenseBatch.findById(req.params.id);

    if (!license) {
      throw new HttpError(404, 'LICENSE_NOT_FOUND', 'License not found.');
    }

    // Get users enrolled with this license
    const enrolledUsers = await User.find({ licenseKey: license.licenseKey })
      .select('name email createdAt')
      .sort({ createdAt: -1 });

    successResponse(res, { license, enrolledUsers }, 'License retrieved successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

/**
 * Update a license batch (toggle active status, extend expiry, etc.)
 * PUT /api/v1/admin/licenses/:id
 */
export const updateLicense = async (req: Request, res: Response) => {
  try {
    const { isActive, expiryDate, maxUsers } = req.body;

    const updateData: { isActive?: boolean; expiryDate?: Date; maxUsers?: number } = {};

    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }

    if (expiryDate) {
      const parsedDate = new Date(expiryDate);
      if (isNaN(parsedDate.getTime())) {
        throw new HttpError(400, 'INVALID_EXPIRY_DATE', 'expiryDate must be a valid date.');
      }
      updateData.expiryDate = parsedDate;
    }

    if (maxUsers !== undefined) {
      if (maxUsers < 1) {
        throw new HttpError(400, 'INVALID_MAX_USERS', 'maxUsers must be at least 1.');
      }
      updateData.maxUsers = maxUsers;
    }

    const license = await LicenseBatch.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!license) {
      throw new HttpError(404, 'LICENSE_NOT_FOUND', 'License not found.');
    }

    successResponse(res, license, 'License updated successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

/**
 * Delete a license batch
 * DELETE /api/v1/admin/licenses/:id
 */
export const deleteLicense = async (req: Request, res: Response) => {
  try {
    const license = await LicenseBatch.findByIdAndDelete(req.params.id);

    if (!license) {
      throw new HttpError(404, 'LICENSE_NOT_FOUND', 'License not found.');
    }

    successResponse(res, null, 'License deleted successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};
