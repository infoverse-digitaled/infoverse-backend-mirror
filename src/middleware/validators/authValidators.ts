import { body } from 'express-validator';

// Define validation and sanitization rules for authentication
export const loginValidationRules = [
  // Validate and sanitize the name field
  body('name')
    .notEmpty().withMessage('Name is required')
    .trim() // <-- Removes leading/trailing whitespace
    .escape(), // <-- Converts special characters to HTML entities

  // Validate and sanitize the email field
  body('email')
    .isEmail().withMessage('Invalid email format')
    .notEmpty().withMessage('Email cannot be empty')
    .normalizeEmail(), // <-- Normalizes the email address

  // Validate and sanitize the password field
  body('password')
    .notEmpty().withMessage('Password is required')
];

export const signupValidationRules = [
  ...loginValidationRules,
  // Validate and sanitize the password field
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.') // <-- Updated to min length of 8
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one number.')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must contain at least one special character.')
    .trim(), // <-- Removes leading/trailing whitespace
];
