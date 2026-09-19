/** HTTP failure with an optional machine-readable code for client recovery flows. */
export class HttpError extends Error {
  statusCode: number;
  code?: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'HttpError';

    // Restoration of prototype chain is required when extending built-ins in TS/JS
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}
