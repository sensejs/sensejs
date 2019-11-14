import {EventEmitter} from 'events';

class MockRedis extends EventEmitter {
  private map: Map<string, any>;
  private status: string;

  constructor() {
    super();
    this.map = new Map();
    this.status = 'disconnect';
  }

  once(event: string, listener: (...args: any[]) => void) {
    if (event === 'connect') {
      setTimeout(listener, 0);
    }
    return this;
  }

  async disconnect() {}

  async set(key: string, value: any) {
    this.map.set(key, value);
    return key;
  }

  async get(key: string) {
    return this.map.get(key);
  }
}

export = MockRedis;
