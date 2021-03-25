import {Component, Inject, invokeMethod, ModuleClass, ModuleRoot, Named, Optional, Tagged} from '../src';
import {Container} from '@sensejs/container';

describe('Inject', () => {
  test('should throw TypeError for invalid service identifier', () => {
    expect(() => Inject(undefined as any)).toThrow(TypeError);
  });
});

describe('Optional', () => {
  const injectToken = Symbol();
  test('Decorate constructor param', async () => {
    const stub = jest.fn();

    @Component()
    class X {
      constructor(@Inject(injectToken) @Optional() param: any) {
        stub(param);
      }
    }

    @ModuleClass({components: [X]})
    class MyModule {
      constructor(@Inject(X) x: any) {}
    }

    await new ModuleRoot(MyModule).start();
    expect(stub).toHaveBeenCalledWith(undefined);
  });

  test('Optional method inject', async () => {
    const stub = jest.fn();

    @Component()
    class X {
      constructor(@Inject(injectToken) @Optional() param: any) {}

      method(@Optional() @Inject(injectToken) param: any) {
        stub(param);
      }
    }

    @ModuleClass({components: [X]})
    class MyModule {
      constructor(@Inject(Container) container: Container) {
        invokeMethod(container.createResolveContext(), X, 'method');
      }
    }

    await new ModuleRoot(MyModule).start();
    expect(stub).toHaveBeenCalledWith(undefined);
  });
});

describe('Decorators', () => {
  test('Inject transformation', async () => {
    const injectToken = Symbol();

    const stub = jest.fn();

    @Component()
    class X {
      constructor() {}

      getParam() {
        return undefined;
      }
    }

    @ModuleClass({components: [X]})
    class MyModule {
      constructor(@Inject(X, {transform: (x: X) => x.getParam()}) x: any) {
        stub(x);
      }
    }

    await new ModuleRoot(MyModule).start();
    expect(stub).toHaveBeenCalledWith(undefined);
  });

  test('Method inject', async () => {
    const result = Math.random();
    const key = Symbol();
    const value = Symbol();

    @Component({
      tags: [{key, value}],
    })
    class Y {}

    @Component()
    class X {
      callable(@Inject(Y) foo1: Y) {
        return result;
      }
    }

    @ModuleClass({components: [X, Y]})
    class MyModule {
      constructor(@Inject(Container) container: Container) {
        expect(invokeMethod(container.createResolveContext(), X, 'callable')).toBe(result);
      }
    }

    await new ModuleRoot(MyModule).start();
  });
});
