import { body } from 'express-validator';

export const userupdateValidationRules = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format')
    .notEmpty()
    .withMessage('Email cannot be empty'),
  body('name')
    .optional()
    .notEmpty()
    .withMessage('Name is required')
    .notEmpty()
    .withMessage('Name cannot be empty'),
];
