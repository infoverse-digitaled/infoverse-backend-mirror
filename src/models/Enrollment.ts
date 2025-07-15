import mongoose from 'mongoose';
import User from './User';
import Course from './Course';

const EnrollmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: User,
    required: [true, 'User is required'],
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: Course,
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
});

// Indexes
EnrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true }); // Prevent duplicate enrollments
EnrollmentSchema.index({ userId: 1 }); // Optimize user-specific queries
EnrollmentSchema.index({ courseId: 1 }); // Optimize course-specific queries

const Enrollment = mongoose.model('Enrollment', EnrollmentSchema);
export default Enrollment;
