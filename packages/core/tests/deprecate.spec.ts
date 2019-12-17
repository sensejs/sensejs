import {Deprecated} from '../src/utils';
import {injectable, inject, Container} from 'inversify';
import {Inject, invokeMethod} from '../src';

const awaitWarningCalled = (stub: jest.SpyInstance) => new Promise((done) => {
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
    class X {
    }

    expect(Reflect.get(X, metadataKey)).toBe(metadata);

  });

  test('warning will be emitted once', async () => {
    const emitWarningSpy = jest.spyOn(process, 'emitWarning');

    @Deprecated()
    class X {
      constructor() {
      }
    }

    const mockCalled = new Promise((done) => {
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

    @injectable()
    @Deprecated({replacedBy: 'unknown'})
    class X {
      constructor(@inject('key') param: any) {
        expect(param).not.toBeUndefined();
        stub(X);
      }
    }

    const stub = jest.fn();

    @Deprecated({replacedBy: X})
    @injectable()
    class Y {
      constructor(@inject('key') param: any) {
        expect(param).not.toBeUndefined();
        stub(Y);
      }
    }

    @injectable()
    class U {
      constructor(@inject('key') param: any) {
        expect(param).not.toBeUndefined();
        stub(U);
      }
    }

    @Deprecated()
    class V extends U {
      constructor(@inject('key') param: any) {
        super(param);
        stub(V);
      }
    }

    @Deprecated()
    class W extends U {
    }

    const container = new Container();
    container.bind('key').toConstantValue('value');
    container.bind(X).toSelf();
    container.bind(Y).toSelf();
    container.bind(V).toSelf();
    container.bind(W).toSelf();

    expect(container.get(X)).toBeInstanceOf(X);
    expect(stub).lastCalledWith(X);
    await awaitWarningCalled(warningStub);

    expect(container.get(Y)).toBeInstanceOf(Y);
    expect(stub).lastCalledWith(Y);
    await awaitWarningCalled(warningStub);

    expect(container.get(V)).toBeInstanceOf(V);
    expect(stub).lastCalledWith(V); // Called With U and V
    await awaitWarningCalled(warningStub);

    expect(container.get(W)).toBeInstanceOf(W);
    expect(stub).lastCalledWith(U);
    await awaitWarningCalled(warningStub);

    expect(stub).toHaveBeenCalledTimes(5);
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

    class X {
      foo(@Inject('key') param: string) {
        return param;
      }
    }

    const container = new Container();
    container.bind('key').toConstantValue(result);
    container.bind(X).toSelf();
    expect(invokeMethod(container, X, X.prototype.foo)).toBe(result);
  });

});
