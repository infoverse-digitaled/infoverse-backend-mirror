import { Response } from 'express';

export const successResponse = (
  res: Response,
  data: any,
  message = 'Success',
  statusCode = 200,
  meta?: any,
) => {
  const response: any = {
    success: true,
    data,
    message,
  };
  if (meta) {
    response.meta = meta;
  }
  res.status(statusCode).json(response);
};
