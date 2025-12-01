
/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - email
 *         - passwordHash
 *         - name
 *         - role
 *       properties:
 *         _id:
 *           type: string
 *           description: The auto-generated id of the user
 *         email:
 *           type: string
 *           description: The email of the user
 *         name:
 *           type: string
 *           description: The name of the user
 *         role:
 *           type: string
 *           enum: [student, instructor, admin]
 *           description: The role of the user
 *         keyStage:
 *           type: string
 *           enum: [ks1, ks2, ks3, ks4]
 *           description: The key stage of the user (UK education system, optional)
 *         yearGroup:
 *           type: number
 *           description: The year group of the user
 *         preferences:
 *           type: object
 *           properties:
 *             subjects:
 *               type: array
 *               items:
 *                 type: string
 *               description: Preferred subjects
 *             learningStyle:
 *               type: string
 *               description: Preferred learning style
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the user was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the user was last updated
 */
import mongoose, { Schema } from 'mongoose';

import { IUser } from './types';

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
      index: true, // <-- Added index here for faster lookups during login
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    role: {
      type: String,
      enum: ['student', 'instructor', 'admin'],
      default: 'student',
      required: true,
    },
    subscription: {
      plan: {
        type: String,
        enum: ['free', 'premium'],
        default: 'free',
      },
      status: {
        type: String,
        enum: ['active', 'inactive', 'cancelled', 'trialing', 'past_due'],
        default: 'active',
      },
      expiresAt: {
        type: Date,
      },
      trialEndsAt: {
        type: Date,
      },
    },
    keyStage: {
      type: String,
      required: false,
      enum: ['ks1', 'ks2', 'ks3', 'ks4'],
    },
    yearGroup: {
      type: Number,
      required: false,
    },
    preferences: {
      type: {
        subjects: {
          type: [String],
          default: [],
        },
        learningStyle: {
          type: String,
          required: false,
        },
      },
      default: { subjects: [] },
    },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true },
);

UserSchema.index({ role: 1 }); // Your existing index for role-based queries

export default mongoose.model<IUser>('User', UserSchema);
