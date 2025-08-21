import mongoose, { Schema } from 'mongoose';
import { IEnrollment } from './types';

const EnrollmentSchema = new Schema<IEnrollment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course is required'],
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'dropped'],
      default: 'active',
    },
  },
  { timestamps: true },
);

// Indexes
EnrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true }); // Your existing compound index to prevent duplicate enrollments
EnrollmentSchema.index({ userId: 1 }); // Your existing index for user-specific queries
EnrollmentSchema.index({ courseId: 1 }); // <-- Added an index for course-specific queries

export default mongoose.model<IEnrollment>('Enrollment', EnrollmentSchema);
