import { Request, Response } from 'express';

export const helloController = (req: Request, res: Response) => {
  res.send('Hello World!');
};
