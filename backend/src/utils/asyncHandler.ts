import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Express (v4) does NOT catch errors thrown inside an async route handler -
 * an unawaited rejected promise just hangs the request or crashes the
 * process, with no 500 response ever sent. Wrapping every async handler in
 * this forwards the error to next(), which our error middleware in app.ts
 * turns into a proper JSON 500 response.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
