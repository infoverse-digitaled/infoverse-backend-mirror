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
EnrollmentSchema.index({ userId: 1 }); // Optimize user-specific queries
EnrollmentSchema.index({ courseId: 1 }); // Optimize course-specific queries

const Enrollment = mongoose.model<IEnrollment>('Enrollment', EnrollmentSchema);
export default Enrollment;
