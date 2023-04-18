import {AsyncIterableQueue} from '../src/async-iterable-queue.js';
import {jest} from '@jest/globals';

describe('BackpressureAsyncIterator', () => {
  describe('basic', () => {
    test('should work', async () => {
      const iterator = new AsyncIterableQueue<number>();
      setImmediate(async () => {
        for (let i = 0; i < 10; i++) {
          await iterator.push(Promise.resolve(i));
        }
        await iterator.finish();
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
      const iterator = new AsyncIterableQueue<number>();
      setImmediate(async () => {
        for (let i = 0; i < 10; i++) {
          await iterator.push(Promise.resolve(i));
        }
        await iterator.finish();
      });

      const values = [];
      for await (const value of iterator) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        values.push(value);
      }
    });

    test('slow producer', async () => {
      const iterator = new AsyncIterableQueue<number>();
      setImmediate(async () => {
        for (let i = 0; i < 10; i++) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          await iterator.push(Promise.resolve(i));
        }
        await iterator.finish();
      });

      const values = [];
      for await (const value of iterator) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        values.push(value);
      }
    });
    test('slow consumer early return', async () => {
      const onCloseSpy = jest.fn();
      const iterator = new AsyncIterableQueue<number>();
      setImmediate(async () => {
        iterator.setOnClose(async () => {
          onCloseSpy();
        });
        for (let i = 0; i < 10; i++) {
          await iterator.push(Promise.resolve(i));
        }
      });

      const getValues = async () => {
        const values = [];
        for await (const value of iterator) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          values.push(value);
          return values;
        }
      };
      await getValues();

      expect(onCloseSpy).toHaveBeenCalled();
    });

    test('slow producer early return', async () => {
      const onCloseSpy = jest.fn();
      const iterator = new AsyncIterableQueue<number>();
      setImmediate(async () => {
        iterator.setOnClose(async () => {
          onCloseSpy();
        });
        for (let i = 0; i < 10; i++) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          await iterator.push(Promise.resolve(i));
        }
      });

      const getValues = async () => {
        const values = [];
        for await (const value of iterator) {
          values.push(value);
          return values;
        }
      };
      await getValues();

      expect(onCloseSpy).toHaveBeenCalled();
    });

    test('out of order resolved promises', async () => {
      const iterator = new AsyncIterableQueue<number>();
      setImmediate(async () => {
        await iterator.push(
          new Promise<number>((resolve) => {
            setTimeout(() => {
              resolve(0);
            }, 10);
          }),
        );
        await iterator.push(Promise.resolve(1));
        await iterator.push(
          new Promise<number>((resolve) => {
            setTimeout(() => {
              resolve(2);
            }, 10);
          }),
        );
        await iterator.push(Promise.resolve(3));
        await iterator.push(Promise.resolve(4));
        await iterator.push(Promise.resolve(5));
        await iterator.push(Promise.resolve(6));
        await iterator.finish();
      });

      const values = [];
      for await (const value of iterator) {
        values.push(value);
      }
      expect(values).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
  });

  describe('aborts and finish', () => {
    test('multiple finish', async () => {
      const spy = jest.fn();
      const iterator = new AsyncIterableQueue<number>();

      setImmediate(async () => {
        spy(await iterator.finish());
        spy(await iterator.finish());
      });
      expect(await iterator.next()).toEqual({
        value: undefined,
        done: true,
      });
      await new Promise<void>(setImmediate);

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenNthCalledWith(1, true);
      expect(spy).toHaveBeenNthCalledWith(2, false);
    });

    test('multiple finish', async () => {
      class CustomError extends Error {}
      const spy = jest.fn();
      const iterator = new AsyncIterableQueue<number>();

      setImmediate(async () => {
        spy(await iterator.abort(new CustomError()));
        spy(await iterator.abort(new CustomError()));
      });
      await expect(iterator.next()).rejects.toBeInstanceOf(CustomError);
      await new Promise<void>(setImmediate);

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenNthCalledWith(1, true);
      expect(spy).toHaveBeenNthCalledWith(2, false);
    });
    test('abort after finish', async () => {
      class CustomError extends Error {}

      const spy = jest.fn();
      const iterator = new AsyncIterableQueue<number>();

      setImmediate(async () => {
        spy(await iterator.finish());
        spy(await iterator.abort(new CustomError()));
      });
      expect(await iterator.next()).toEqual({
        value: undefined,
        done: true,
      });
      await new Promise<void>(setImmediate);

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenNthCalledWith(1, true);
      expect(spy).toHaveBeenNthCalledWith(2, false);
    });
    test('finish after abort', async () => {
      class CustomError extends Error {}
      const spy = jest.fn();
      const iterator = new AsyncIterableQueue<number>();

      setImmediate(async () => {
        spy(await iterator.abort(new CustomError()));
        spy(await iterator.finish());
      });
      await expect(iterator.next()).rejects.toBeInstanceOf(CustomError);
      await new Promise<void>(setImmediate);

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenNthCalledWith(1, true);
      expect(spy).toHaveBeenNthCalledWith(2, false);
    });

    test('aborts after value produced', async () => {
      const iterator = new AsyncIterableQueue<number>();

      setImmediate(async () => {
        await iterator.push(
          new Promise<number>((resolve) => {
            setTimeout(() => {
              resolve(0);
            }, 10);
          }),
        );
        await iterator.push(Promise.resolve(1));
        await iterator.push(
          new Promise<number>((resolve) => {
            setTimeout(() => {
              resolve(2);
            }, 10);
          }),
        );
        await iterator.push(Promise.resolve(3));
        await iterator.abort(new Error());
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
      expect(values).toEqual([0, 1, 2, 3]);
      expect(error).toBeInstanceOf(Error);
    });

    test('aborting with a slow consumer', async () => {
      const iterator = new AsyncIterableQueue<number>();

      setImmediate(async () => {
        await iterator.push(
          new Promise<number>((resolve) => {
            setTimeout(() => {
              resolve(0);
            }, 10);
          }),
        );
        await iterator.push(Promise.resolve(1));
        await iterator.push(
          new Promise<number>((resolve) => {
            setTimeout(() => {
              resolve(2);
            }, 10);
          }),
        );
        await iterator.push(Promise.resolve(3));
        await iterator.push(Promise.resolve(4));
        await iterator.push(Promise.resolve(5));
        await iterator.push(Promise.resolve(6));
        await iterator.abort(new Error());
      });

      const values = [];
      let error;
      try {
        for await (const value of iterator) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          values.push(value);
        }
      } catch (e) {
        error = e;
      }
      expect(values).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('Early finish', () => {
    test('exception handling', async () => {
      class CustomError extends Error {}

      const onCloseSpy = jest.fn();
      const iterator = new AsyncIterableQueue<number>();

      setImmediate(async () => {
        iterator.setOnClose(async () => {
          onCloseSpy();
        });
        for (let i = 0; i < 10; i++) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          await iterator.push(Promise.resolve(i));
        }
      });

      const values = [];
      const runIterator = async () => {
        let error;
        try {
          for await (const value of iterator) {
            values.push(value);
            throw new CustomError();
          }
        } catch (e) {
          error = e;
        } finally {
          expect(error).toBeInstanceOf(CustomError);
        }
      };
      await runIterator();
      expect(onCloseSpy).toHaveBeenCalled();
    });

    test('early return', async () => {
      const spy = jest.fn();
      await new Promise<void>((resolve, reject) => {
        const iterator = new AsyncIterableQueue<number>();

        setImmediate(async () => {
          for (let i = 0; i < 10; i++) {
            await new Promise((resolve) => setTimeout(resolve, 10));
            spy(await iterator.push(Promise.resolve(i)));
          }
          resolve();
        });

        const values = [];
        const runIterator = async () => {
          for await (const value of iterator) {
            values.push(value);
            return;
          }
        };
        runIterator().catch(reject);
      });
      expect(spy).toHaveBeenCalledWith(true);
      expect(spy).toHaveBeenCalledWith(false);
    });
  });
});
