import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscriber extends Document {
  email: string;
  subscribedAt: Date;
  isActive: boolean;
}

const SubscriberSchema = new Schema<ISubscriber>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
      index: true,
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model<ISubscriber>('Subscriber', SubscriberSchema);
