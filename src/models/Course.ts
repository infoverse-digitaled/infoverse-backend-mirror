/**
 * @swagger
 * components:
 *   schemas:
 *     Course:
 *       type: object
 *       required:
 *         - title
 *         - description
 *         - instructorId
 *       properties:
 *         _id:
 *           type: string
 *           description: The auto-generated id of the course
 *         title:
 *           type: string
 *           description: The title of the course
 *         description:
 *           type: string
 *           description: The description of the course
 *         instructorId:
 *           type: string
 *           description: The id of the instructor
 *         thumbnailUrl:
 *           type: string
 *           description: The URL of the course thumbnail
 *         price:
 *           type: number
 *           description: The price of the course
 *         source:
 *           type: string
 *           enum: [internal, oak]
 *           description: The source of the course content
 *         oakMetadata:
 *           type: object
 *           properties:
 *             keyStage:
 *               type: string
 *             subjectSlug:
 *               type: string
 *           description: Metadata for Oak-sourced courses
 *         syllabus:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               contentType:
 *                 type: string
 *                 enum: [video, text, quiz]
 *               contentUrl:
 *                 type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the course was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the course was last updated
 */
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
      required: [
        function isInstructorRequired(this: ICourse) {
          return this.source === 'internal';
        },
        'Instructor is required for internal courses',
      ],
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
    source: {
      type: String,
      enum: ['internal', 'oak'],
      default: 'internal',
      required: true,
    },
    oakMetadata: {
      type: {
        keyStage: {
          type: String,
          enum: ['ks1', 'ks2', 'ks3', 'ks4'],
          required: false,
        },
        subjectSlug: {
          type: String,
          required: false,
        },
      },
      required: false,
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
CourseSchema.index({ source: 1 }); // Index for filtering by source
CourseSchema.index({ 'oakMetadata.keyStage': 1, 'oakMetadata.subjectSlug': 1 }); // Index for Oak course queries

export default mongoose.model<ICourse>('Course', CourseSchema);
