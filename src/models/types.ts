import { Document } from 'mongoose';

// User Interface
export interface IUser extends Document {
  email: string;
  passwordHash?: string; // Optional for OAuth users
  name: string;
  role: 'student' | 'instructor' | 'admin' | 'schooladmin';
  subscription: {
    plan: string;
    status: 'free' | 'active' | 'inactive' | 'cancelled' | 'trialing' | 'past_due';
    expiresAt?: Date;
    trialEndsAt?: Date;
    paystackSubscriptionCode?: string; // Stored so we can cancel before switching plans
  };
  // B2B License fields
  licenseKey?: string;
  organizationName?: string;
  // School Admin fields
  schoolCode?: string;
  schoolName?: string;
  keyStage?: 'ks1' | 'ks2' | 'ks3' | 'ks4';
  yearGroup?: number;
  preferences: {
    subjects: string[];
    learningStyle?: string;
  };
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  // Streak tracking
  lastActiveAt?: Date;
  activityDates?: Date[];
  currentStreak?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Course Interface
export interface ICourse extends Document {
  title: string;
  description: string;
  instructorId: IUser['_id'];
  thumbnailUrl?: string;
  price: number;
  source: 'internal' | 'oak';
  oakMetadata?: {
    keyStage: 'ks1' | 'ks2' | 'ks3' | 'ks4';
    subjectSlug: string;
  };
  syllabus: {
    title: string;
    contentType: 'video' | 'text' | 'quiz';
    contentUrl: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

// Enrollment Interface
export interface IEnrollment extends Document {
  userId: IUser['_id'];
  courseId: ICourse['_id'];
  enrolledAt: Date;
  status: 'active' | 'completed' | 'dropped';
  createdAt: Date;
  updatedAt: Date;
}

// Review Interface
export interface IReview extends Document {
  userId: IUser['_id'];
  courseId: ICourse['_id'];
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Oak Enrollment Interface
export interface IOakEnrollment extends Document {
  userId: IUser['_id'];
  keyStage: 'ks1' | 'ks2' | 'ks3' | 'ks4';
  subjectSlug: string;
  status: 'active' | 'completed' | 'archived';
  startDate: Date;
  lastAccessedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  updateLastAccessed(): Promise<IOakEnrollment>;
}

// Progress Interface
export interface IProgress extends Document {
  enrollmentId: IOakEnrollment['_id'];
  userId: IUser['_id'];
  unitSlug: string;
  lessonSlug: string;
  status: 'started' | 'completed';
  quizScore?: number;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  markCompleted(quizScore?: number): Promise<IProgress>;
}

// License Batch Interface (B2B School Licensing)
export interface ILicenseBatch extends Document {
  schoolName: string;
  licenseKey: string;
  maxUsers: number;
  enrolledCount: number;
  expiryDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Blog Post Interface
export interface IBlogPost extends Document {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  featuredImage?: string;
  type: 'BLOG' | 'NURTURED';
  published: boolean;
  publishedAt?: Date;
  author: IUser['_id'];
  createdAt: Date;
  updatedAt: Date;
}
