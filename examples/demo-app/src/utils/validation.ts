import * as st from 'suretype';
export function createTransformer<T extends st.CoreValidator<unknown>>(type: T, onError: (e: unknown[]) => never) {
  const validator = st.compile(type);
  return (input: unknown) => {
    const result = validator(input);
    if (result.ok) {
      return input as st.TypeOf<T>;
    }
    onError(result.errors);
  };
}
