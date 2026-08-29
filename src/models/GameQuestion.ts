/**
 * @swagger
 * components:
 *   schemas:
 *     GameQuestion:
 *       type: object
 *       required:
 *         - gameSlug
 *         - keyStage
 *         - difficulty
 *         - question
 *         - options
 *         - correctAnswerIndex
 *       properties:
 *         _id:
 *           type: string
 *           description: The auto-generated id of the question
 *         gameSlug:
 *           type: string
 *           description: Which game this question belongs to (e.g. 'millionaire')
 *         keyStage:
 *           type: string
 *           enum: [ks1, ks2, ks3, ks4]
 *           description: The key stage this question is written for
 *         subject:
 *           type: string
 *           description: The subject area, or 'mixed'
 *         difficulty:
 *           type: number
 *           description: Money-ladder rung this question can appear at (1-15)
 *         question:
 *           type: string
 *         options:
 *           type: array
 *           items:
 *             type: string
 *           minItems: 4
 *           maxItems: 4
 *         correctAnswerIndex:
 *           type: number
 *           description: Index (0-3) into options of the correct answer
 *         explanation:
 *           type: string
 *         usageCount:
 *           type: number
 *           description: How many times this question has been served, used to spread repeats
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
import mongoose, { Schema } from 'mongoose';

import { IGameQuestion } from './types';

const GameQuestionSchema = new Schema<IGameQuestion>(
  {
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
      type: Number,
      required: [true, 'Difficulty is required'],
      min: [1, 'Difficulty must be between 1 and 15'],
      max: [15, 'Difficulty must be between 1 and 15'],
    },
    question: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
    },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (options: string[]) => options.length === 4,
        message: 'A question must have exactly 4 options',
      },
    },
    correctAnswerIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    explanation: {
      type: String,
      trim: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// Pool draws filter by game/key-stage/subject/difficulty
GameQuestionSchema.index({ gameSlug: 1, keyStage: 1, subject: 1, difficulty: 1 });

export default mongoose.model<IGameQuestion>('GameQuestion', GameQuestionSchema);
