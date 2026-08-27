import { body } from 'express-validator';
import { signupValidationRules } from './authValidators';

export const adminCreateUserValidationRules = [
  ...signupValidationRules,
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['student', 'instructor', 'admin'])
    .withMessage('Role must be one of: student, instructor, admin')
    .trim()
    .escape(),
];

export const adminUpdateUserValidationRules = [
  body('email').optional().isEmail().withMessage('Invalid email format').normalizeEmail(),
  body('name').optional().notEmpty().withMessage('Name cannot be empty').trim().escape(),
  body('password').optional().notEmpty().withMessage('Password cannot be empty'),
];

export const adminCourseCreationValidationRules = [
  body('title').notEmpty().withMessage('Title is required').trim().escape(),
  body('description').notEmpty().withMessage('Description is required').trim().escape(),
  body('thumbnailUrl').notEmpty().withMessage('Thumbnail URL is required').trim().escape(),
  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isNumeric()
    .withMessage('Price must be a number')
    .trim()
    .escape(),
  body('syllabus').notEmpty().isArray({ min: 1 }).withMessage('Syllabus is required'),
  body('syllabus.*.title')
    .notEmpty()
    .withMessage('Syllabus item title is required')
    .trim()
    .escape(),
  body('syllabus.*.contentType')
    .notEmpty()
    .isIn(['video', 'text', 'quiz'])
    .withMessage('Content type must be one of: video, text, quiz'),
  body('syllabus.*.contentUrl').isURL().withMessage('Content URL must be a valid URL'),
  body('instructorId').notEmpty().withMessage('Instructor ID is required').trim().escape(),
];
