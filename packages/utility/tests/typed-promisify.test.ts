import {
  aggregatedPromisifiedCall,
  aggregatedPromisify,
  NodeCallback,
  promisifiedCall,
  promisify,
} from '../src/index.js';

function f1(cb: NodeCallback<number>) {
  return cb(null, 42);
}
function f2(cb: NodeCallback<number>) {
  return cb(new Error());
}

function g1(a: number, b: string, cb: (...e: [Error] | [null, ...number[]]) => void) {
  return cb(null, 42, 43);
}

function g2(a: number, b: string, cb: (...e: [Error] | [null, ...number[]]) => void) {
  return cb(new Error());
}

function g3(a: number, b: string, cb: (...e: [Error] | [null, ...number[]]) => void) {
  return cb(null);
}

function overload(cb: (e: Error | null, value: number) => void): void;
function overload(param1: boolean, cb: (e: Error | null, value: boolean) => void): void;

function overload<T extends any[]>(...args: T) {
  const cb = args.pop() as any;
  switch (args.length) {
    case 0:
      cb(null, 1);
      return;
    case 1:
      cb(null, true);
      return;
    default:
      throw new Error();
  }
}
function overload2(cb: (e: Error | null, value: number, value2: boolean) => void): void;
function overload2(param1: boolean, cb: (e: Error | null, value: boolean, value2: number) => void): void;

function overload2<T extends any[]>(...args: T) {
  const cb = args.pop() as any;
  switch (args.length) {
    case 0:
      cb(null, 1);
      return;
    case 1:
      cb(null, true);
      return;
    default:
      throw new Error();
  }
}

test('resolve overload', async () => {
  const fn = promisify(overload);
  let r1: number = await promisifiedCall(overload);
  expect(typeof r1 === 'number');
  r1 = await fn();
  expect(typeof r1 === 'number');

  let r2: boolean = await promisifiedCall(overload, true);
  expect(typeof r2 === 'boolean');
  r2 = await fn(true);
  expect(typeof r2 === 'boolean');

  const pf = await aggregatedPromisify(overload2);

  let result1 = await aggregatedPromisifiedCall(overload2);
  expect(typeof result1[0] === 'number');
  expect(typeof result1[1] === 'boolean');

  result1 = await pf();
  expect(typeof result1[0] === 'number');
  expect(typeof result1[1] === 'boolean');

  let result2 = await aggregatedPromisifiedCall(overload2, true);
  expect(typeof result2[0] === 'boolean');
  expect(typeof result2[1] === 'number');
  result2 = await pf(false);
  expect(typeof result2[0] === 'boolean');
  expect(typeof result2[1] === 'number');
});

test('promisify', async () => {
  await expect(promisify(f1)()).resolves.toBe(42);
  await expect(promisify(f2)()).rejects.toBeInstanceOf(Error);
});

test('promisifiedCall', async () => {
  await expect(promisifiedCall(f1)).resolves.toBe(42);
  await expect(promisifiedCall(f2)).rejects.toBeInstanceOf(Error);
});

test('aggregatedPromisify', async () => {
  await expect(aggregatedPromisify(f1)()).resolves.toEqual([42]);
  await expect(aggregatedPromisify(f2)()).rejects.toBeInstanceOf(Error);

  await expect(aggregatedPromisify(g1)(0, '')).resolves.toEqual(expect.objectContaining([42, 43]));
  await expect(aggregatedPromisify(g2)(0, '')).rejects.toBeInstanceOf(Error);
  await expect(aggregatedPromisify(g3)(0, '')).resolves.toEqual([]);
});

test('promisifiedCall', async () => {
  await expect(aggregatedPromisifiedCall(f1)).resolves.toEqual([42]);
  await expect(aggregatedPromisifiedCall(f2)).rejects.toBeInstanceOf(Error);

  await expect(aggregatedPromisifiedCall(g1, 0, '')).resolves.toEqual(expect.objectContaining([42, 43]));
  await expect(aggregatedPromisifiedCall(g2, 0, '')).rejects.toBeInstanceOf(Error);
  await expect(aggregatedPromisifiedCall(g3, 0, '')).resolves.toEqual([]);
});
