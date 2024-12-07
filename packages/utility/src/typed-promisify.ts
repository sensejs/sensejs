export type NodeCallback<R, E = Error> = (...args: [E] | [null | undefined, R]) => any;
export type AggregatedNodeCallback<R extends any[], E = Error> = (...args: [E] | [null | undefined, ...R]) => any;

type InferParam<T> = T extends (...args: [Error] | [null | undefined, infer R]) => any
  ? R
  : T extends (error: Error | null, result: infer R) => any // Workaround common but inaccurate callback typing pattern
    ? R
    : never;

type InferAggregateParam<T> = T extends (...args: [Error] | [null | undefined, ...infer R]) => any
  ? R
  : T extends (error: Error | null, ...args: infer R) => any // Workaround common but inaccurate callback typing pattern
    ? R
    : never;

type PromisifyOne<T> = T extends [...infer A, infer U] ? (...args: A) => Promise<InferParam<U>> : never;

type PromisifyAggregated<T> = T extends [...infer A, infer U] ? (...args: A) => Promise<InferAggregateParam<U>> : never;

type OverloadToUnion<T> = T extends {
  (...o: infer U1): void;
  (...o: infer U2): void;
  (...o: infer U3): void;
  (...o: infer U4): void;
}
  ? U1 | U2 | U3 | U4
  : T extends {
        (...o: infer U1): void;
        (...o: infer U2): void;
        (...o: infer U3): void;
      }
    ? U1 | U2 | U3
    : T extends {
          (...o: infer U1): void;
          (...o: infer U2): void;
        }
      ? U1 | U2
      : T extends {
            (...o: infer U1): void;
          }
        ? U1
        : never;

type InferOverload<T, A> = T extends [...infer P, infer U] ? (A extends P ? InferParam<U> : never) : never;

type ResolveOverloadedCall<T, A> = T extends {
  (...o: infer U1): void;
  (...o: infer U2): void;
  (...o: infer U3): void;
  (...o: infer U4): void;
}
  ? InferOverload<U1, A> | InferOverload<U2, A> | InferOverload<U3, A> | InferOverload<U4, A>
  : T extends {
        (...o: infer U1): void;
        (...o: infer U2): void;
        (...o: infer U3): void;
      }
    ? InferOverload<U1, A> | InferOverload<U2, A> | InferOverload<U3, A>
    : T extends {
          (...o: infer U1): void;
          (...o: infer U2): void;
        }
      ? InferOverload<U1, A> | InferOverload<U2, A>
      : T extends {
            (...o: infer U1): void;
          }
        ? InferOverload<U1, A>
        : never;

export type InferSpreadOverload<T, A> = T extends [...infer P, infer U]
  ? A extends P
    ? InferAggregateParam<U>
    : never
  : never;

export type ResolveOverloadedCallAndSpread<T, A> = T extends {
  (...o: infer U1): void;
  (...o: infer U2): void;
  (...o: infer U3): void;
  (...o: infer U4): void;
}
  ? InferSpreadOverload<U1, A> | InferSpreadOverload<U2, A> | InferSpreadOverload<U3, A> | InferSpreadOverload<U4, A>
  : T extends {
        (...o: infer U1): void;
        (...o: infer U2): void;
        (...o: infer U3): void;
      }
    ? InferSpreadOverload<U1, A> | InferSpreadOverload<U2, A> | InferSpreadOverload<U3, A>
    : T extends {
          (...o: infer U1): void;
          (...o: infer U2): void;
        }
      ? InferSpreadOverload<U1, A> | InferSpreadOverload<U2, A>
      : T extends {
            (...o: infer U1): void;
          }
        ? InferSpreadOverload<U1, A>
        : never;

/**
 * Convert union function types to intersection
 * e.g. Convert `((a: number) => void) | (a: number, b: string) => void)` to
 * `((a: number) => void) & (a: number, b: string) => void)`.
 */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

export type TypedPromisify<T> = UnionToIntersection<PromisifyOne<OverloadToUnion<T>>>;

export type TypedAggregatedPromisify<T> = UnionToIntersection<PromisifyAggregated<OverloadToUnion<T>>>;

export function promisify<F extends Function>(fn: F): TypedPromisify<F> {
  return ((...args: any[]): Promise<any> =>
    new Promise<any>((resolve, reject) => {
      return fn(...args, (...args: [Error] | [null | undefined, any]) => {
        if (args[0]) {
          return reject(args[0]);
        }
        return resolve(args[1]);
      });
    })) as TypedPromisify<F>;
}

export function aggregatedPromisify<F extends Function>(fn: F): TypedAggregatedPromisify<F> {
  return ((...args: any[]): Promise<any> => {
    return new Promise<any>((resolve, reject) => {
      return fn(...args, (...args: any[]) => {
        if (args[0]) {
          return reject(args[0]);
        }
        const [, ...r] = args;
        return resolve(r);
      });
    });
  }) as TypedAggregatedPromisify<F>;
}

export function promisifiedCall<F extends Function, A extends any[]>(
  fn: F,
  ...rest: A
): Promise<ResolveOverloadedCall<F, A>> {
  return new Promise<any>((resolve, reject) => {
    return fn(...rest, (...args: [Error] | [null | undefined, any]) => {
      if (args[0]) {
        return reject(args[0]);
      }
      return resolve(args[1]);
    });
  });
}

export function aggregatedPromisifiedCall<F extends Function, A extends any[]>(
  fn: F,
  ...rest: A
): Promise<ResolveOverloadedCallAndSpread<F, A>> {
  return new Promise<any>((resolve, reject) => {
    return fn(...rest, (...args: any[]) => {
      if (args[0]) {
        return reject(args[0]);
      }
      const [, ...r] = args;
      return resolve(r);
    });
  });
}
