/**
 * @swagger
 * components:
 *   schemas:
 *     Progress:
 *       type: object
 *       required:
 *         - enrollmentId
 *         - userId
 *         - unitSlug
 *         - lessonSlug
 *         - status
 *       properties:
 *         _id:
 *           type: string
 *           description: The auto-generated id of the progress record
 *         enrollmentId:
 *           type: string
 *           description: Reference to the OakEnrollment
 *         userId:
 *           type: string
 *           description: Reference to the User (denormalized for faster queries)
 *         unitSlug:
 *           type: string
 *           description: The Oak unit slug
 *         lessonSlug:
 *           type: string
 *           description: The Oak lesson slug
 *         status:
 *           type: string
 *           enum: [started, completed]
 *           description: The status of the lesson
 *         quizScore:
 *           type: number
 *           description: The quiz score (optional, percentage 0-100)
 *         completedAt:
 *           type: string
 *           format: date-time
 *           description: When the lesson was completed
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the progress was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the progress was last updated
 */
import mongoose, { Schema, Model } from 'mongoose';

import { IProgress } from './types';

interface IProgressModel extends Model<IProgress> {
  calculateUnitProgress(
    enrollmentId: mongoose.Types.ObjectId,
    unitSlug: string,
    totalLessons: number,
  ): Promise<{
    completedLessons: number;
    totalLessons: number;
    percentageComplete: number;
  }>;
}

const ProgressSchema = new Schema<IProgress, IProgressModel>(
  {
    enrollmentId: {
      type: Schema.Types.ObjectId,
      ref: 'OakEnrollment',
      required: [true, 'Enrollment ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    unitSlug: {
      type: String,
      required: [true, 'Unit slug is required'],
      trim: true,
      lowercase: true,
    },
    lessonSlug: {
      type: String,
      required: [true, 'Lesson slug is required'],
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ['started', 'completed'],
      default: 'started',
      required: true,
    },
    quizScore: {
      type: Number,
      min: [0, 'Quiz score cannot be negative'],
      max: [100, 'Quiz score cannot exceed 100'],
      required: false,
    },
    completedAt: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true },
);

// Compound index to prevent duplicate progress records
ProgressSchema.index(
  { enrollmentId: 1, lessonSlug: 1 },
  { unique: true },
);

// Additional indexes for common queries
ProgressSchema.index({ userId: 1, status: 1 });
ProgressSchema.index({ enrollmentId: 1, unitSlug: 1 });
ProgressSchema.index({ enrollmentId: 1, unitSlug: 1, status: 1 });

// Instance method to mark lesson as completed
ProgressSchema.methods.markCompleted = function (quizScore?: number) {
  this.status = 'completed';
  this.completedAt = new Date();
  if (quizScore !== undefined) {
    this.quizScore = quizScore;
  }
  return this.save();
};

// Static method to calculate unit progress
ProgressSchema.statics.calculateUnitProgress = async function (
  enrollmentId: mongoose.Types.ObjectId,
  unitSlug: string,
  totalLessons: number,
) {
  const completedLessons = await this.countDocuments({
    enrollmentId,
    unitSlug,
    status: 'completed',
  });

  const percentageComplete =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return {
    completedLessons,
    totalLessons,
    percentageComplete,
  };
};

export default mongoose.model<IProgress, IProgressModel>('Progress', ProgressSchema);
