import {EventIterator} from 'event-iterator';

interface IteratorController<T> {
  readonly push: (value: Promise<T>) => Promise<void>;
  readonly finish: () => void;
  readonly abort: (err: Error) => void;
  onClose?: () => Promise<void>;
}

export function backpressureAsyncIterator<T>(cb: (controller: IteratorController<T>) => void) {
  return new EventIterator<T>(
    (queue) => {
      let full = false;
      queue.on('highWater', () => {
        full = true;
      });

      queue.on('lowWater', () => {
        full = false;
        pushValues();
      });
      const actionQueue: (() => void)[] = [];

      function pushValues() {
        const action = actionQueue.shift();
        if (typeof action === 'undefined') {
          return;
        }

        action();
        process.nextTick(() => {
          if (!full) {
            pushValues();
          }
        });
      }

      const controller: IteratorController<T> = {
        push: async (value: Promise<T>) => {
          return new Promise((resolve, reject) => {
            actionQueue.push(() => {
              value.then((v) => {
                queue.push(v);
                resolve();
              }, reject);
            });
            if (!full) {
              process.nextTick(pushValues);
            }
          });
        },
        finish: () => {
          actionQueue.push(() => {
            queue.stop();
          });
          if (!full) {
            process.nextTick(pushValues);
          }
        },
        abort: (err: Error) => {
          queue.fail(err);
        },
      };

      process.nextTick(() => {
        cb(controller);
      });

      return async () => {
        await controller.onClose?.();
      };
    },
    {highWaterMark: 5, lowWaterMark: 1},
  );
}
