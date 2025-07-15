import mongoose from 'mongoose';
import User from './User';

const CourseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
  },
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: User,
    required: [true, 'Instructor is required'],
  },
  thumbnailUrl: {
    type: String,
    trim: true,
  },
  price: {
    type: Number,
    default: 0,
    min: [0, 'Price cannot be negative'],
  },
  syllabus: [
    {
      title: { type: String, required: true },
      contentType: { type: String, enum: ['video', 'text', 'quiz'], default: 'video' },
      contentUrl: { type: String, required: true },
    },
  ],
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
CourseSchema.index({ title: 'text', description: 'text' }); // Text search for title and description
CourseSchema.index({ instructorId: 1 }); // Index for instructor-specific queries

// Pre-save hook to update `updatedAt`
// eslint-disable-next-line func-names
CourseSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const Course = mongoose.model('Course', CourseSchema);
export default Course;
