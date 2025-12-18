/**
 * @swagger
 * components:
 *   schemas:
 *     BlogPost:
 *       type: object
 *       required:
 *         - title
 *         - slug
 *         - content
 *         - type
 *         - author
 *       properties:
 *         _id:
 *           type: string
 *           description: The auto-generated id of the blog post
 *         title:
 *           type: string
 *           description: The title of the post
 *         slug:
 *           type: string
 *           description: URL-friendly slug (unique)
 *         content:
 *           type: string
 *           description: The content in markdown format
 *         excerpt:
 *           type: string
 *           description: Short summary of the post
 *         featuredImage:
 *           type: string
 *           description: URL to the featured image
 *         type:
 *           type: string
 *           enum: [BLOG, NURTURED]
 *           description: The type of content
 *         published:
 *           type: boolean
 *           description: Whether the post is published
 *         publishedAt:
 *           type: string
 *           format: date-time
 *           description: When the post was published
 *         author:
 *           type: string
 *           description: The ID of the author
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the post was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the post was last updated
 */
import mongoose, { Schema } from 'mongoose';

import { IBlogPost } from './types';

const BlogPostSchema = new Schema<IBlogPost>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
    },
    excerpt: {
      type: String,
      trim: true,
      maxlength: [500, 'Excerpt cannot exceed 500 characters'],
    },
    featuredImage: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['BLOG', 'NURTURED'],
      required: [true, 'Type is required'],
      default: 'BLOG',
    },
    published: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
    },
  },
  { timestamps: true },
);

// Index for querying published posts by type
BlogPostSchema.index({ published: 1, type: 1, publishedAt: -1 });

// Text index for search
BlogPostSchema.index({ title: 'text', content: 'text', excerpt: 'text' });

export default mongoose.model<IBlogPost>('BlogPost', BlogPostSchema);
