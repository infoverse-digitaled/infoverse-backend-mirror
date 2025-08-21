import mongoose, { Schema } from 'mongoose';
import { ICourse } from './types';

const CourseSchema = new Schema<ICourse>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      index: true, // <-- Add index here for general queries
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    instructorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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
        contentType: {
          type: String,
          enum: ['video', 'text', 'quiz'],
          default: 'video',
        },
        contentUrl: { type: String, required: true },
      },
    ],
  },
  { timestamps: true },
);

// Indexes
CourseSchema.index({ title: 'text', description: 'text' }); // Text search for title and description
CourseSchema.index({ instructorId: 1 }); // Index for instructor-specific queries

export default mongoose.model<ICourse>('Course', CourseSchema);
