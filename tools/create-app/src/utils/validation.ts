import * as iots from 'io-ts';
import * as fpts from 'fp-ts';

export function createTransformer<A, O = A, I = unknown>(type: iots.Type<A, O, I>, onError: (e: iots.Errors) => never) {
  return (input: I): A => {
    const result = type.decode(input);
    const getOrElse = fpts.either.getOrElse(
      (e: iots.Errors): A => {
        onError(e);
      },
    );
    return getOrElse(result);
  };
}
