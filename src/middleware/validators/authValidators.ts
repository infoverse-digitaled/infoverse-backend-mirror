import { body } from 'express-validator';

export const loginValidationRules = [
  // Validate and sanitize the email field
  body('email')
    .isEmail()
    .withMessage('Invalid email format')
    .notEmpty()
    .withMessage('Email cannot be empty')
    .normalizeEmail(),

  // Validate and sanitize the password field
  body('password').notEmpty().withMessage('Password is required'),
];

export const signupValidationRules = [
  // Validate and sanitize the name field
  body('name').notEmpty().withMessage('Name is required').trim().escape(),

  // Validate and sanitize the email field
  body('email')
    .isEmail()
    .withMessage('Invalid email format')
    .notEmpty()
    .withMessage('Email cannot be empty')
    .normalizeEmail(),

  // Validate and sanitize the password field
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long.')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter.')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter.')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number.')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Password must contain at least one special character.')
    .trim(),
];

export const forgotPasswordValidationRules = [
  // Validate and sanitize the email field
  body('email')
    .isEmail()
    .withMessage('Invalid email format')
    .notEmpty()
    .withMessage('Email cannot be empty')
    .normalizeEmail(),
];

export const resetPasswordValidationRules = [
  // Validate and sanitize the password field
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long.')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter.')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter.')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number.')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Password must contain at least one special character.')
    .trim(),
];

export const onboardingValidationRules = [
  // Validate role (optional but must be valid if provided)
  body('role')
    .optional()
    .isIn(['student', 'instructor'])
    .withMessage('Role must be either "student" or "instructor".')
    .trim(),

  // Validate keyStage (optional but must be valid if provided)
  body('keyStage')
    .optional()
    .isIn(['ks1', 'ks2', 'ks3', 'ks4'])
    .withMessage('Key stage must be one of: ks1, ks2, ks3, ks4.')
    .trim(),
];

export const updateProfileValidationRules = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long.')
    .trim()
    .escape(),
];

export const changePasswordValidationRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),

  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long.')
    .matches(/[A-Z]/)
    .withMessage('New password must contain at least one uppercase letter.')
    .matches(/[a-z]/)
    .withMessage('New password must contain at least one lowercase letter.')
    .matches(/[0-9]/)
    .withMessage('New password must contain at least one number.')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('New password must contain at least one special character.')
    .trim(),
];
