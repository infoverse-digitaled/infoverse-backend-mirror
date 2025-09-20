import { body } from 'express-validator';


export const loginValidationRules = [
  // Validate and sanitize the name field
  body('name')
    .notEmpty().withMessage('Name is required')
    .trim() 
    .escape(), 

  // Validate and sanitize the email field
  body('email')
    .isEmail().withMessage('Invalid email format')
    .notEmpty().withMessage('Email cannot be empty')
    .normalizeEmail(), 

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

export const forgotPasswordValidationRules = [
  // Validate and sanitize the email field
  body('email')
    .isEmail().withMessage('Invalid email format')
    .notEmpty().withMessage('Email cannot be empty')
    .normalizeEmail(),
];

export const resetPasswordValidationRules = [
  // Validate and sanitize the password field
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one number.')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must contain at least one special character.')
    .trim(),
];