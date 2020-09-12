export type NodeCallback<R, E = Error> = (...args: [Error] | [null | undefined, R]) => any;
export type AggregatedNodeCallback<R extends unknown[], E = Error> = (
  ...args: [Error] | [null | undefined, ...R]
) => any;

export function promisify<R, E, T extends unknown[]>(f: (...param: [...T, NodeCallback<R, E>]) => any) {
  return (...args: [...T]): Promise<R> =>
    new Promise<R>((resolve, reject) => {
      return f(...args, (...args: [Error, ...any] | [null | undefined, R]) => {
        if (args[0]) {
          return reject(args[0]);
        }
        return resolve(args[1]);
      });
    });
}

export function promisifiedCall<R, E, T extends unknown[]>(
  f: (...param: [...T, NodeCallback<R, E>]) => any,
  ...param: T
): Promise<R> {
  return new Promise<R>((resolve, reject) =>
    f(...param, (...args: [Error, ...any] | [null | undefined, R]) => {
      if (args[0]) {
        return reject(args[0]);
      }
      return resolve(args[1]);
    }),
  );
}

export function aggregatedPromisify<R extends unknown[], E, T extends unknown[]>(
  f: (...param: [...T, AggregatedNodeCallback<R, E>]) => any,
) {
  return (...args: [...T]): Promise<R> =>
    new Promise<R>((resolve, reject) => {
      return f(...args, (...args: [Error, ...any] | [null | undefined, ...R]) => {
        if (args[0]) {
          return reject(args[0]);
        }
        const [, ...r] = args;
        return resolve(r);
      });
    });
}

export function aggregatedPromisifiedCall<R extends unknown[], E, T extends unknown[]>(
  f: (...param: [...T, AggregatedNodeCallback<R, E>]) => any,
  ...param: T
): Promise<R> {
  return new Promise<R>((resolve, reject) =>
    f(...param, (...args: [Error, ...any] | [null | undefined, ...R]) => {
      if (args[0]) {
        return reject(args[0]);
      }
      const [, ...r] = args;
      return resolve(r);
    }),
  );
}
