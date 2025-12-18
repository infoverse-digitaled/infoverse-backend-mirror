/**
 * @swagger
 * components:
 *   schemas:
 *     LicenseBatch:
 *       type: object
 *       required:
 *         - schoolName
 *         - licenseKey
 *         - maxUsers
 *         - expiryDate
 *       properties:
 *         _id:
 *           type: string
 *           description: The auto-generated id of the license batch
 *         schoolName:
 *           type: string
 *           description: The name of the school
 *         licenseKey:
 *           type: string
 *           description: "The unique license key (format: SCHOOL-XXXX-XXXX)"
 *         maxUsers:
 *           type: number
 *           description: Maximum number of users allowed for this license
 *         enrolledCount:
 *           type: number
 *           description: Current number of enrolled users
 *         expiryDate:
 *           type: string
 *           format: date-time
 *           description: When the license expires
 *         isActive:
 *           type: boolean
 *           description: Whether the license is currently active
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the license was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the license was last updated
 */
import mongoose, { Schema } from 'mongoose';
import crypto from 'crypto';

import { ILicenseBatch } from './types';

const LicenseBatchSchema = new Schema<ILicenseBatch>(
  {
    schoolName: {
      type: String,
      required: [true, 'School name is required'],
      trim: true,
    },
    licenseKey: {
      type: String,
      required: [true, 'License key is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    maxUsers: {
      type: Number,
      required: [true, 'Maximum users is required'],
      min: [1, 'Maximum users must be at least 1'],
    },
    enrolledCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// Index for querying active licenses
LicenseBatchSchema.index({ isActive: 1, expiryDate: 1 });

/**
 * Generate a unique license key in format: SCHOOL-XXXX-XXXX
 */
export const generateLicenseKey = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segment1 = Array.from({ length: 4 }, () => chars[crypto.randomInt(chars.length)]).join('');
  const segment2 = Array.from({ length: 4 }, () => chars[crypto.randomInt(chars.length)]).join('');
  return `SCHOOL-${segment1}-${segment2}`;
};

export default mongoose.model<ILicenseBatch>('LicenseBatch', LicenseBatchSchema);
