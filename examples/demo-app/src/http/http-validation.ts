import {TypeOf, v} from 'suretype';
import {createTransformer} from '../utils/validation.js';
import {HttpError} from './http-error.js';

function throwValidationError(e: object): never {
  throw new HttpError(400, 'VALIDATION_ERROR', 'Validation Error', e);
}

export const CreateAuthorForm = v.object({
  name: v.string().required(),
});

export type CreateAuthorFormType = TypeOf<typeof CreateAuthorForm>;

export const validateCreateAuthorForm = createTransformer(CreateAuthorForm, throwValidationError);
export const CreateBookForm = v.object({
  name: v.string().required(),
});

export const validateCreateBookForm = createTransformer(CreateBookForm, throwValidationError);
