enum State {
  IDLE = 0,
  AWAITING_PULL,
  AWAITING_PUSH,
  CLOSED,
}

export type ControllerIdle = {
  state: State.IDLE;
};

export type ControllerAwaitingPull<T> = {
  state: State.AWAITING_PULL;
  valuePromise: Promise<T>;
  resolve: () => void;
  reject: (err: unknown) => void;
};

export type ControllerAwaitingPush<T> = {
  state: State.AWAITING_PUSH;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
};

export type ControllerClosed = {
  state: State.CLOSED;
  reason?: unknown;
};

export type ControllerState<T> =
  | ControllerIdle
  | ControllerAwaitingPull<T>
  | ControllerAwaitingPush<T>
  | ControllerClosed;

export class AsyncIterableQueue<T> implements AsyncIterator<T> {
  #state: ControllerState<T> = {state: State.IDLE};
  #promiseQueue: Promise<void> = Promise.resolve();
  #onClose: () => Promise<void> = () => Promise.resolve();

  /**
   * Provides a callback to be called when the iterator is closed.
   * @param onClose
   */
  setOnClose(onClose: () => Promise<void>) {
    this.#onClose = onClose;
    return this;
  }

  /**
   * Pushes a value into the iterator.
   * @param valuePromise A promise that resolves to the value to push.
   * @returns A promise that resolves to true if the value was pushed, or false if the iterator was closed.
   */
  async push(valuePromise: Promise<T>) {
    await this.#promiseQueue;

    switch (this.#state.state) {
      case State.IDLE: {
        this.#promiseQueue = new Promise((resolve, reject) => {
          this.#state = {
            state: State.AWAITING_PULL,
            valuePromise,
            resolve,
            reject,
          };
        });
        return true;
      }
      case State.AWAITING_PUSH: {
        const resolve = this.#state.resolve;
        const reject = this.#state.reject;
        this.#promiseQueue = valuePromise.then(resolve, reject).finally(() => {
          this.#state = {state: State.IDLE};
        });
        return true;
      }
      case State.CLOSED: {
        return false;
      }
      default:
        // istanbul ignore next
        throw new Error('BUG: Unreachable');
    }
  }

  /**
   * Aborts the iterator.
   * @returns Returns true when this call aborted the iterator, or false if the iterator was already closed or aborted.
   */
  async abort(e?: Error) {
    await this.#promiseQueue;
    switch (this.#state.state) {
      case State.IDLE: {
        this.#state = {state: State.CLOSED, reason: e};
        return true;
      }

      case State.AWAITING_PUSH: {
        this.#state.reject(e);
        this.#state = {state: State.CLOSED, reason: e};
        return true;
      }

      case State.CLOSED: {
        return false;
      }
      case State.AWAITING_PULL: {
        // istanbul ignore next
        throw new Error('BUG: Unreachable');
      }
    }
  }

  /**
   * Closes the iterator.
   * @returns Returns true when this call closed the iterator, or false if the iterator was already closed or aborted.
   */
  async finish() {
    await this.#promiseQueue;
    switch (this.#state.state) {
      case State.IDLE: {
        this.#state = {state: State.CLOSED};
        return true;
      }
      case State.AWAITING_PUSH: {
        const reject = this.#state.reject;
        this.#state = {state: State.CLOSED};
        reject(null);
        return true;
      }
      case State.CLOSED: {
        return false;
      }
      default: {
        // istanbul ignore next
        throw new Error('Invalid State');
      }
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return this;
  }

  async next(...args: [] | [undefined]): Promise<IteratorResult<T, any>> {
    switch (this.#state.state) {
      case State.IDLE: {
        return new Promise<T>((resolve, reject) => {
          this.#state = {
            state: State.AWAITING_PUSH,
            resolve,
            reject,
          };
        }).then(
          (value) => {
            return {
              value,
              done: false,
            };
          },
          (e) => {
            if (this.#state.state !== State.CLOSED) {
              // istanbul ignore next
              throw new Error('BUG: Invalid State');
            }
            if (this.#state.reason === e) {
              throw e;
            }
            return {
              value: undefined,
              done: true,
            };
          },
        );
      }
      case State.AWAITING_PULL: {
        const value = await this.#state.valuePromise;
        this.#state.resolve();
        this.#state = {state: State.IDLE};
        return {value, done: false};
      }
      case State.CLOSED: {
        if (this.#state.reason) {
          throw this.#state.reason;
        }
        return {value: undefined, done: true};
      }
      default:
        // istanbul ignore next
        throw new Error('Illegal State');
    }
  }

  async return(value?: any): Promise<IteratorResult<T, any>> {
    switch (this.#state.state) {
      case State.CLOSED:
      case State.IDLE:
      case State.AWAITING_PUSH: {
        this.#state = {state: State.CLOSED};
        await this.#onClose();
        return {value: undefined, done: true};
      }

      case State.AWAITING_PULL: {
        const valuePromise = this.#state.valuePromise;
        this.#state = {state: State.CLOSED};
        try {
          const value = await valuePromise;
          return {value, done: false};
        } finally {
          await this.#onClose();
        }
      }
    }
  }
}
