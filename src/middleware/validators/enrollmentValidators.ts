import { body } from 'express-validator';

export const updateEnrollmentValidationRules = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['active', 'completed', 'dropped'])
    .withMessage('Invalid status'),
];
