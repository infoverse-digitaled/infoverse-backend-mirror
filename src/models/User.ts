import mongoose, { Schema } from 'mongoose';
import { IUser } from './types';

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    role: {
      type: String,
      enum: ['student', 'instructor'],
      default: 'student',
      required: true,
    },
  },
  { timestamps: true },
);

UserSchema.index({ email: 1 }); // Unique index for email lookups
UserSchema.index({ role: 1 }); // Index for role-based queries

export default mongoose.model<IUser>('User', UserSchema);
