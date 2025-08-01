import { body } from 'express-validator';

export const userupdateValidationRules = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format')
    .notEmpty()
    .withMessage('Email cannot be empty')
    .trim()
    .escape(),
  body('name')
    .optional()
    .notEmpty()
    .withMessage('Name is required')
    .notEmpty()
    .withMessage('Name cannot be empty')
    .trim()
    .escape(),
];
