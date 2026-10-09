import { randomUUID } from 'node:crypto';
import { ErrorRequestHandler, NextFunction, Request, Response } from 'express';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const suppliedId = req.get('x-request-id');
  req.requestId = suppliedId && /^[A-Za-z0-9._-]{1,128}$/.test(suppliedId) ? suppliedId : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

export function notFoundMiddleware(req: Request, res: Response) {
  return res.status(404).json({ error: 'Route not found', requestId: req.requestId });
}

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  if (res.headersSent) return;

  const status = typeof error === 'object' && error !== null && 'status' in error &&
    typeof error.status === 'number' && error.status >= 400 && error.status < 500
    ? error.status
    : 500;

  if (status >= 500) console.error('Unhandled API error', { requestId: req.requestId, error });
  return res.status(status).json({
    error: status === 500 ? 'Internal server error' : 'Invalid request',
    requestId: req.requestId,
  });
};