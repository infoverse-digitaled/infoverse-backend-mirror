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
