export class MultipartError implements Error {
  readonly name;
  constructor(readonly message: string) {
    this.name = new.target.name;
  }
}

export class MultipartLimitExceededError extends MultipartError {}

export class InvalidMultipartBodyError extends MultipartError {}
