export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    public readonly errorMessage: string,
    public readonly errorDetail: object,
  ) {
    super();
    Error.captureStackTrace(this, HttpError);
  }
}
