import {Class, ServiceId} from '@sensejs/container';

export class InvalidComponentError extends Error {
  constructor(readonly target: Class) {
    super(`${target.name} is not a component`);
    Error.captureStackTrace(this, InvalidComponentError);
  }
}

export class InvalidComponentIdError extends Error {
  constructor(readonly target: Class, readonly serviceId: ServiceId) {
    super(`${serviceId.toString()} is not a valid id for ${target.name}`);
    Error.captureStackTrace(this, InvalidComponentIdError);
  }
}
