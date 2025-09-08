import { body } from 'express-validator';

export const userUpdateValidationRules = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format')
    .notEmpty()
    .withMessage('Email cannot be empty')
    .trim(),
  body('name')
    .optional()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .trim(),
  body('currentPassword')
    .if(body('newPassword').exists({ checkFalsy: true }))
    .notEmpty()
    .withMessage('Current password is required to set a new password'),
  body('newPassword')
    .if(body('currentPassword').exists({ checkFalsy: true }))
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long'),
];
