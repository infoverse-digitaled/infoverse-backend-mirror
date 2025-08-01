import { body } from 'express-validator';

export const reviewValidationRules = [
  body('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isNumeric()
    .withMessage('Rating must be a number')
    .isFloat({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment').notEmpty().withMessage('Comment is required'),
];
