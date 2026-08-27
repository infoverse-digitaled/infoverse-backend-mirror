import mongoose, { Schema, Document } from 'mongoose';

export interface IBugReport extends Document {
  type: 'bug' | 'feature' | 'general' | 'improvement';
  message: string;
  rating?: number;
  email?: string;
  userId?: string;
  page: string;
  userAgent: string;
  status: 'new' | 'reviewed' | 'resolved';
  createdAt: Date;
  updatedAt: Date;
}

const BugReportSchema = new Schema<IBugReport>(
  {
    type: {
      type: String,
      required: [true, 'Report type is required'],
      enum: {
        values: ['bug', 'feature', 'general', 'improvement'],
        message: 'Type must be bug, feature, general, or improvement',
      },
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
    },
    rating: {
      type: Number,
      min: [1, 'Rating must be between 1 and 5'],
      max: [5, 'Rating must be between 1 and 5'],
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
    },
    userId: {
      type: String,
      trim: true,
    },
    page: {
      type: String,
      required: [true, 'Page URL is required'],
      trim: true,
    },
    userAgent: {
      type: String,
      required: [true, 'User agent is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['new', 'reviewed', 'resolved'],
      default: 'new',
    },
  },
  { timestamps: true },
);

BugReportSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<IBugReport>('BugReport', BugReportSchema);
