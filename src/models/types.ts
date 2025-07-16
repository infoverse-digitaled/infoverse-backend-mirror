import { Document } from 'mongoose';

// User Interface
export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: 'student' | 'instructor';
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
  status: 'active' | 'completed' | 'dropped';
  createdAt: Date;
  updatedAt: Date;
}
