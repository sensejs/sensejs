import {jest} from '@jest/globals';
import {Deprecated} from '../src/utils';
import {BindingType, Container, Inject, Injectable} from '@sensejs/container';
import {invokeMethod} from '../src';

// TODO: Typing error of jest
const awaitWarningCalled = (stub: any) =>
  new Promise<void>((done) => {
    stub.mockImplementationOnce(() => {
      done();
    });
  });
describe('Deprecate on class', () => {
  test('metadata', () => {
    const metadataKey = Symbol();
    const metadata = Symbol();

    const decorator = (constructor: Function) => {
      Reflect.set(constructor, metadataKey, metadata);
    };

    @Deprecated()
    @decorator
    class X {}
    expect(Reflect.get(X, metadataKey)).toBe(metadata);

    @decorator
    @Deprecated({message: 'Y is deprecated'})
    class Y {}
    expect(Reflect.get(Y, metadataKey)).toBe(metadata);
  });

  test('warning will be emitted once', async () => {
    const emitWarningSpy = jest.spyOn(process, 'emitWarning');

    @Deprecated()
    class X {
      constructor() {}
    }

    const mockCalled = new Promise<void>((done) => {
      emitWarningSpy.mockImplementation(() => {
        done();
      });
    });
    const x = new X();

    // decorator should not change the type of created value
    expect(x).toBeInstanceOf(X);

    await mockCalled;
    expect(emitWarningSpy).toHaveBeenCalledTimes(1);
    const y = new X();
    await new Promise((done) => setTimeout(done, 1));
    expect(emitWarningSpy).toHaveBeenCalledTimes(1);
  });

  test('injectable', async () => {
    const warningStub = jest.spyOn(process, 'emitWarning');
    const stub = jest.fn();

    @Injectable()
    @Deprecated({replacedBy: 'unknown'})
    class X {
      constructor(@Inject('key') param: any) {
        expect(param).not.toBeUndefined();
        stub(X);
      }
    }

    @Deprecated({replacedBy: X})
    @Injectable()
    class Y {
      constructor(@Inject('key') param: any) {
        expect(param).not.toBeUndefined();
        stub(Y);
      }
    }

    @Injectable()
    class U {
      constructor(@Inject('key') param: any) {
        expect(param).not.toBeUndefined();
        stub(U);
      }
    }

    @Deprecated()
    class V extends U {
      constructor(@Inject('key') param: any) {
        super(param);
        stub(V);
      }
    }

    const container = new Container();
    container.addBinding({
      type: BindingType.CONSTANT,
      id: 'key',
      value: 'value',
    });
    container.add(X);
    container.add(Y);
    container.add(V);

    expect(container.resolve(X)).toBeInstanceOf(X);
    expect(stub).lastCalledWith(X);
    await awaitWarningCalled(warningStub);

    expect(container.resolve(Y)).toBeInstanceOf(Y);
    expect(stub).lastCalledWith(Y);
    await awaitWarningCalled(warningStub);

    expect(container.resolve(V)).toBeInstanceOf(V);
    expect(stub).lastCalledWith(V); // Called With U and V
    await awaitWarningCalled(warningStub);

    expect(stub).toHaveBeenCalledTimes(4);
  });
});

describe('Deprecate instance method', () => {
  test('warning emitted', async () => {
    const warningStub = jest.spyOn(process, 'emitWarning');
    const param = [Symbol(), Symbol()];
    const result = Symbol();

    const symbolMethod = Symbol();

    class X {
      @Deprecated()
      static [symbolMethod](...args: unknown[]) {
        expect(args).toEqual(param);
        return result;
      }

      @Deprecated()
      static staticMethod(...args: unknown[]) {
        expect(args).toEqual(param);
        return result;
      }

      @Deprecated()
      [symbolMethod](...args: unknown[]) {
        expect(args).toEqual(param);
        return result;
      }

      @Deprecated({replacedBy: symbolMethod})
      instanceMethod(...args: unknown[]) {
        expect(args).toEqual(param);
        return result;
      }
    }

    expect(X[symbolMethod](...param)).toBe(result);
    await awaitWarningCalled(warningStub);
    expect(X.staticMethod(...param)).toBe(result);
    await awaitWarningCalled(warningStub);
    expect(new X()[symbolMethod](...param)).toBe(result);
    await awaitWarningCalled(warningStub);
    expect(new X().instanceMethod(...param)).toBe(result);
    await awaitWarningCalled(warningStub);
  });

  test('method inject', () => {
    const result = Date.now().toString();

    @Injectable()
    class X {
      foo(@Inject('key') param: string) {
        return param;
      }
    }

    const container = new Container();
    container.addBinding({
      type: BindingType.CONSTANT,
      id: 'key',
      value: result,
    });
    container.add(X);
    try {
      expect(invokeMethod(container.createResolveContext(), X, 'foo')).toBe(result);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
});
