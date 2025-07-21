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
EnrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true }); // Prevent duplicate enrollments
EnrollmentSchema.index({ userId: 1 });

export default mongoose.model<IEnrollment>('Enrollment', EnrollmentSchema);
