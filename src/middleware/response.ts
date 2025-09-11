import { Response } from "express";
export const successResponse = (res: Response, data: any, message = 'Success', statusCode = 200) => {
    res.status(statusCode).json({
        success: true,
        data,
        message
    });
}