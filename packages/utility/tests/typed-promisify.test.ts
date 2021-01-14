import {aggregatedPromisifiedCall, aggregatedPromisify, NodeCallback, promisifiedCall, promisify} from '../src';

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
