import { Request, Response } from 'express';
import { successResponse } from '../middleware/response';

export const helloController = (req: Request, res: Response) => {
  successResponse(res, [], 'Hello to the Infoverse!');
};
