import mongoose, { Schema } from 'mongoose';
import { IReview } from './types';

const ReviewSchema = new Schema<IReview>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course is required'],
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
  },
  comment: {
    type: String,
    trim: true,
    maxlength: [500, 'Comment cannot exceed 500 characters'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes
ReviewSchema.index({ userId: 1, courseId: 1 }, { unique: true }); // Prevent multiple reviews per user per course
ReviewSchema.index({ courseId: 1, createdAt: -1 }); // Optimize course review queries
ReviewSchema.index({ userId: 1 }); // Optimize user-specific review queries

export default mongoose.model('Review', ReviewSchema);
