import * as iots from 'io-ts';
import {createTransformer} from '../utils/validation';
import {HttpError} from './http-error';

function throwValidationError(e: object): never {
  throw new HttpError(400, 'VALIDATION_ERROR', 'Validation Error', e);
}

export const CreateAuthorForm = iots.type({
  name: iots.string,
});

export type CreateAuthorFormType = iots.TypeOf<typeof CreateAuthorForm>;

export const CreateAuthorFormTransformer = createTransformer(CreateAuthorForm, throwValidationError);
export const CreateBookForm = iots.type({
  name: iots.string,
});
export type CreateBookFormType = iots.TypeOf<typeof CreateBookForm>;

export const CreateBookFormTransformer = createTransformer(CreateBookForm, throwValidationError);
