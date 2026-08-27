import { Response } from 'express';

// `meta` has no default and trails two defaulted params - reordering would mean
// touching every one of this helper's ~40 call sites across the app for a
// pure style rule, which is a bigger risk than the rule itself.
export const successResponse = (
  res: Response,
  data: unknown,
  // eslint-disable-next-line default-param-last
  message = 'Success',
  // eslint-disable-next-line default-param-last
  statusCode = 200,
  meta?: unknown,
) => {
  const response: { success: true; data: unknown; message: string; meta?: unknown } = {
    success: true,
    data,
    message,
  };
  if (meta) {
    response.meta = meta;
  }
  res.status(statusCode).json(response);
};
