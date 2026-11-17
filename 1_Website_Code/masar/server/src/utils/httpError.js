// Errors with an HTTP status. `code` is a stable key the front-end
// translates into Arabic or English.
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code, message, details) => new HttpError(400, code, message, details);
export const unauthorized = (code = 'UNAUTHORIZED', message = 'Please log in') => new HttpError(401, code, message);
export const forbidden = (code = 'FORBIDDEN', message = 'Not allowed') => new HttpError(403, code, message);
export const notFound = (code = 'NOT_FOUND', message = 'Not found') => new HttpError(404, code, message);
export const conflict = (code, message) => new HttpError(409, code, message);
