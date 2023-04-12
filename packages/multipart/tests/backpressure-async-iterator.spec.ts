import {backpressureAsyncIterator} from '../src/backpressure-async-iterator.js';
import {jest} from '@jest/globals';

describe('BackpressureAsyncIterator', () => {
  test('should work', async () => {
    const iterator = backpressureAsyncIterator<number>(async (controller) => {
      for (let i = 0; i < 10; i++) {
        await controller.push(Promise.resolve(i));
      }
      await controller.finish();
    });

    const values = [];
    for await (const value of iterator) {
      values.push(value);
      if (values.length > 10) {
        break;
      }
    }
    expect(values).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test('slow consumer', async () => {
    const iterator = backpressureAsyncIterator<number>(async (controller) => {
      for (let i = 0; i < 10; i++) {
        await controller.push(Promise.resolve(i));
      }
      await controller.finish();
    });

    const values = [];
    for await (const value of iterator) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      values.push(value);
    }
  });

  test('slow producer', async () => {
    const iterator = backpressureAsyncIterator<number>(async (controller) => {
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        await controller.push(Promise.resolve(i));
      }
      await controller.finish();
    });

    const values = [];
    for await (const value of iterator) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      values.push(value);
    }
  });

  test('early finish', async () => {
    const onCloseSpy = jest.fn();
    const iterator = backpressureAsyncIterator<number>(async (controller) => {
      controller.onClose = async () => {
        onCloseSpy();
      };
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        await controller.push(Promise.resolve(i));
      }
    });

    const values = [];
    for await (const value of iterator) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      values.push(value);
      break;
    }

    expect(onCloseSpy).toHaveBeenCalled();
  });

  test('exception handling', async () => {
    const onCloseSpy = jest.fn();
    const iterator = backpressureAsyncIterator<number>(async (controller) => {
      controller.onClose = async () => {
        onCloseSpy();
      };
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        await controller.push(Promise.resolve(i));
      }
    });

    const values = [];
    let error;
    try {
      for await (const value of iterator) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        values.push(value);
        throw new Error();
      }
    } catch (e) {
      error = e;
    } finally {
      expect(onCloseSpy).toHaveBeenCalled();
      expect(error).toBeInstanceOf(Error);
    }
  });

  test('out of order resolved promises', async () => {
    const iterator = backpressureAsyncIterator<number>(async (controller) => {
      await controller.push(
        new Promise<number>((resolve) => {
          setTimeout(() => {
            resolve(0);
          }, 10);
        }),
      );
      await controller.push(Promise.resolve(1));
      await controller.push(
        new Promise<number>((resolve) => {
          setTimeout(() => {
            resolve(2);
          }, 10);
        }),
      );
      await controller.push(Promise.resolve(3));
      await controller.push(Promise.resolve(4));
      await controller.push(Promise.resolve(5));
      await controller.push(Promise.resolve(6));
      await controller.finish();
    });

    const values = [];
    for await (const value of iterator) {
      values.push(value);
    }
    expect(values).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  test('abort', async () => {
    const iterator = backpressureAsyncIterator<number>(async (controller) => {
      await controller.push(
        new Promise<number>((resolve) => {
          setTimeout(() => {
            resolve(0);
          }, 10);
        }),
      );
      await controller.push(Promise.resolve(1));
      await controller.push(
        new Promise<number>((resolve) => {
          setTimeout(() => {
            resolve(2);
          }, 10);
        }),
      );
      await controller.push(Promise.resolve(3));
      await controller.push(Promise.resolve(4));
      await controller.push(Promise.resolve(5));
      await controller.push(Promise.resolve(6));
      await controller.abort(new Error());
    });

    const values = [];
    let error;
    try {
      for await (const value of iterator) {
        values.push(value);
      }
    } catch (e) {
      error = e;
    }
    expect(values).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(error).toBeInstanceOf(Error);
  });
});
