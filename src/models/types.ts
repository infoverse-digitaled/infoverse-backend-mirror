import { Document } from 'mongoose';

// User Interface
export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: 'student' | 'instructor';
  subscription: {
    plan: 'free' | 'premium';
    status: 'active' | 'inactive' | 'cancelled' | 'trialing' | 'past_due';
    expiresAt?: Date;
    trialEndsAt?: Date;
  };
  keyStage?: 'ks1' | 'ks2' | 'ks3' | 'ks4';
  yearGroup?: number;
  preferences: {
    subjects: string[];
    learningStyle?: string;
  };
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
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
