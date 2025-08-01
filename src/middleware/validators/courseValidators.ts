import { body } from 'express-validator';

export const courseValidationRules = [
  body('title').notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('price').isNumeric().isFloat({ gt: 0 }).withMessage('Price must be a positive number'),
  body('thumbnailUrl').isURL().withMessage('Thumbnail URL must be a valid URL'),
  body('syllabus').notEmpty().isArray({ min: 1 }).withMessage('Syllabus is required'),
  body('syllabus.*.title').notEmpty().withMessage('Syllabus item title is required'),
  body('syllabus.*.contentType')
    .notEmpty()
    .isIn(['video', 'text', 'quiz'])
    .withMessage('Content type must be one of: video, text, quiz'),
  body('syllabus.*.contentUrl').isURL().withMessage('Content URL must be a valid URL'),
];

export const updateCourseValidationRules = [
  body('title').optional().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().notEmpty().withMessage('Description cannot be empty'),
  body('price').optional().isNumeric().withMessage('Price must be a number'),
  body('thumbnailUrl').optional().isURL().withMessage('Thumbnail URL must be a valid URL'),
  body('syllabus').optional().isArray().withMessage('Syllabus must be an array of objects'),
  body('syllabus.*.title').optional().notEmpty().withMessage('Syllabus item title is required'),
  body('syllabus.*.contentType')
    .optional()
    .notEmpty()
    .isIn(['video', 'text', 'quiz'])
    .withMessage('Content type must be one of: video, text, quiz'),
  body('syllabus.*.contentUrl').optional().isURL().withMessage('Content URL must be a valid URL'),
];
