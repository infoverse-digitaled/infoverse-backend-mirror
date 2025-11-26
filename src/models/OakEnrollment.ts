/**
 * @swagger
 * components:
 *   schemas:
 *     OakEnrollment:
 *       type: object
 *       required:
 *         - userId
 *         - keyStage
 *         - subjectSlug
 *         - status
 *         - startDate
 *       properties:
 *         _id:
 *           type: string
 *           description: The auto-generated id of the enrollment
 *         userId:
 *           type: string
 *           description: Reference to the User
 *         keyStage:
 *           type: string
 *           enum: [ks1, ks2, ks3, ks4]
 *           description: The key stage for this Oak content
 *         subjectSlug:
 *           type: string
 *           description: The Oak subject slug (e.g., 'maths', 'english')
 *         status:
 *           type: string
 *           enum: [active, completed, archived]
 *           description: The status of the enrollment
 *         startDate:
 *           type: string
 *           format: date-time
 *           description: When the student started this enrollment
 *         lastAccessedAt:
 *           type: string
 *           format: date-time
 *           description: When the student last accessed this content
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the enrollment was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the enrollment was last updated
 */
import mongoose, { Schema } from 'mongoose';

import { IOakEnrollment } from './types';

const OakEnrollmentSchema = new Schema<IOakEnrollment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    keyStage: {
      type: String,
      enum: ['ks1', 'ks2', 'ks3', 'ks4'],
      required: [true, 'Key Stage is required'],
    },
    subjectSlug: {
      type: String,
      required: [true, 'Subject slug is required'],
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'archived'],
      default: 'active',
      required: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    lastAccessedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

// Compound index to prevent duplicate enrollments for the same user + subject
OakEnrollmentSchema.index({ userId: 1, subjectSlug: 1 }, { unique: true });

// Additional indexes for common queries
OakEnrollmentSchema.index({ userId: 1, status: 1 });
OakEnrollmentSchema.index({ keyStage: 1, subjectSlug: 1 });

// Instance method to update last accessed timestamp
OakEnrollmentSchema.methods.updateLastAccessed = function () {
  this.lastAccessedAt = new Date();
  return this.save();
};

export default mongoose.model<IOakEnrollment>('OakEnrollment', OakEnrollmentSchema);
