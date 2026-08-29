/**
 * @swagger
 * components:
 *   schemas:
 *     GameSession:
 *       type: object
 *       required:
 *         - userId
 *         - gameSlug
 *         - keyStage
 *         - difficulty
 *         - status
 *       properties:
 *         _id:
 *           type: string
 *           description: The auto-generated id of the session
 *         userId:
 *           type: string
 *           description: Reference to the User playing
 *         gameSlug:
 *           type: string
 *           description: Which game this session is for (e.g. 'millionaire')
 *         keyStage:
 *           type: string
 *           enum: [ks1, ks2, ks3, ks4]
 *         subject:
 *           type: string
 *         difficulty:
 *           type: string
 *           enum: [easy, medium, hard]
 *         currentStep:
 *           type: number
 *           description: Current money-ladder rung (0-14)
 *         status:
 *           type: string
 *           enum: [in_progress, won, lost, abandoned]
 *         score:
 *           type: number
 *         xpEarned:
 *           type: number
 *         startedAt:
 *           type: string
 *           format: date-time
 *         completedAt:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
import mongoose, { Schema, Model } from 'mongoose';

import { IGameSession } from './types';

const GameQuestionAskedSchema = new Schema(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      ref: 'GameQuestion',
      required: true,
    },
    selectedOptionIndex: {
      type: Number,
      min: 0,
      max: 3,
    },
    isCorrect: {
      type: Boolean,
    },
    answeredAt: {
      type: Date,
    },
  },
  { _id: false },
);

const GameSessionSchema = new Schema<IGameSession, Model<IGameSession>>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    gameSlug: {
      type: String,
      required: [true, 'Game slug is required'],
      trim: true,
      lowercase: true,
      default: 'millionaire',
    },
    keyStage: {
      type: String,
      enum: ['ks1', 'ks2', 'ks3', 'ks4'],
      required: [true, 'Key Stage is required'],
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      default: 'mixed',
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      required: [true, 'Difficulty is required'],
    },
    currentStep: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['in_progress', 'won', 'lost', 'abandoned'],
      default: 'in_progress',
      required: true,
    },
    questionsAsked: {
      type: [GameQuestionAskedSchema],
      default: [],
    },
    score: {
      type: Number,
      default: 0,
    },
    xpEarned: {
      type: Number,
      default: 0,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

// Common query patterns: a user's sessions, and leaderboard aggregation over recent sessions
GameSessionSchema.index({ userId: 1, gameSlug: 1, status: 1 });
GameSessionSchema.index({ gameSlug: 1, status: 1, completedAt: -1 });

// Instance method to close out a session
GameSessionSchema.methods.markCompleted = function markCompleted(
  status: 'won' | 'lost' | 'abandoned',
) {
  this.status = status;
  this.completedAt = new Date();
  return this.save();
};

export default mongoose.model<IGameSession>('GameSession', GameSessionSchema);
