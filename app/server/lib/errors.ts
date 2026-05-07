import { HTTPException } from 'hono/http-exception';

export class HttpError extends HTTPException {
  constructor(status: 400 | 401 | 403 | 404 | 409 | 422 | 500, message: string) {
    super(status, { message });
  }
}

export const NotFound = (msg = 'Not Found') => new HttpError(404, msg);
export const Unauthorized = (msg = 'Unauthorized') => new HttpError(401, msg);
export const Forbidden = (msg = 'Forbidden') => new HttpError(403, msg);
export const BadRequest = (msg = 'Bad Request') => new HttpError(400, msg);
