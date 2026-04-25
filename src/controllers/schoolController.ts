import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { SignJWT } from 'jose';
import crypto from 'crypto';
import User from '../models/User';
import LicenseBatch from '../models/LicenseBatch';
import { HttpError } from '../utils/httpError';
import config from '../config';
import { successResponse } from '../middleware/response';

/**
 * Handles school admin registration and generates a unique school code.
 * POST /api/v1/auth/school-register (or similar route mapping)
 */
export const registerSchoolAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, schoolName } = req.body;

    if (!name || !email || !password || !schoolName) {
      throw new HttpError(400, 'MISSING_FIELDS', 'Name, email, password, and school name are required.');
    }

    // Check if a user with the same email already exists.
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new HttpError(400, 'USER_EXISTS', 'A user with this email already exists.');
    }

    // Generate unique schoolCode
    const sanitizedSchoolName = schoolName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8);
    const randomString = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
    const schoolCode = `${sanitizedSchoolName}-${randomString}`;

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create School Admin user
    const newUser = await User.create({
      name,
      email,
      passwordHash,
      role: 'schooladmin',
      schoolCode,
      schoolName,
      subscription: {
        status: 'trialing',
        plan: 'premium',
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day trial for schools
      },
    });

    // Create the "Master Control" (LicenseBatch) document
    await LicenseBatch.create({
      schoolName,
      licenseKey: schoolCode,
      maxUsers: 100, // Default trial capacity
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    });

    // Create JWT
    const secret = new TextEncoder().encode(config.jwt.secret);
    const token = await new SignJWT({ userId: String(newUser._id), role: newUser.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(config.jwt.expiresIn)
      .sign(secret);

    const responseData = {
      ...newUser.toObject(),
      token,
      skipPayment: false, // Will redirect to pricing page initially
    };

    // Remove passwordHash from response
    delete responseData.passwordHash;

    successResponse(res, responseData, 'School Admin registered successfully', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Fetch students enrolled under the school admin's schoolCode.
 * GET /api/v1/school/students
 */
export const getStudents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userRole = (req as any).user?.role;
    const userId = (req as any).user?.userId || (req as any).user?.id; // Depends on your middleware

    if (userRole !== 'schooladmin') {
      throw new HttpError(403, 'FORBIDDEN', 'Only school admins can access this resource.');
    }

    // Get the school admin's code
    const adminUser = await User.findById(userId);
    if (!adminUser || !adminUser.schoolCode) {
      throw new HttpError(404, 'NOT_FOUND', 'School admin details not found.');
    }

    // Find all standard students who registered with this code
    // Assuming licenseKey or schoolCode on students maps directly to the admin's schoolCode.
    // We update the backend to ensure students using "school mode" set `schoolCode: adminUser.schoolCode`.
    const students = await User.find({
      role: 'student',
      $or: [
        { schoolCode: adminUser.schoolCode },
        { licenseKey: adminUser.schoolCode } // Fallback for backwards compatibility with existing UI
      ]
    }).select('-passwordHash -__v');

    successResponse(res, { students, schoolCode: adminUser.schoolCode, schoolName: adminUser.schoolName }, 'Students retrieved successfully', 200);
  } catch (err) {
    next(err);
  }
};
