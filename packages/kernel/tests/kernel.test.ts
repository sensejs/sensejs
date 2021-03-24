import {BindingType, Kernel, Scope} from '../src/kernel';
import {untransformed} from '../lib/kernel';

describe('Kernel', () => {
  test('simple resolve', () => {
    const kernel = new Kernel();
    const value = 1;

    class Foo {
      constructor(readonly param: number) {}
    }

    kernel.addBinding({
      type: BindingType.CONSTANT,
      value,
      id: '1',
    });

    kernel.addBinding({
      id: Foo,
      type: BindingType.INSTANCE,
      constructor: Foo,
      paramInjectionMetadata: [{id: '1', index: 0, optional: false, transform: untransformed}],
      scope: Scope.SINGLETON,
    });

    const result = kernel.resolve(Foo);
    expect(result).toBeInstanceOf(Foo);
    expect(result.param).toBe(value);
  });

  test('optional', () => {
    const kernel = new Kernel();
    const value = 1;

    class Foo {
      constructor(readonly param: number, readonly optional?: any) {}
    }

    kernel.addBinding({
      type: BindingType.CONSTANT,
      value,
      id: '1',
    });

    kernel.addBinding({
      id: Foo,
      type: BindingType.INSTANCE,
      constructor: Foo,
      paramInjectionMetadata: [
        {id: '1', index: 0, optional: false, transform: untransformed},
        {id: 'optional', index: 1, optional: true, transform: untransformed},
      ],
      scope: Scope.SINGLETON,
    });

    const result = kernel.resolve(Foo);
    expect(result).toBeInstanceOf(Foo);
    expect(result.param).toBe(value);
    expect(result.optional).toBe(undefined);
  });

  test('singleton alias', () => {
    const kernel = new Kernel();

    class Foo {
      constructor() {}
    }

    class Bar {
      constructor(readonly param1: any, readonly param2: any) {}
    }

    kernel.addBinding({
      id: Foo,
      type: BindingType.INSTANCE,
      constructor: Foo,
      paramInjectionMetadata: [],
      scope: Scope.SINGLETON,
    });

    kernel.addBinding({
      id: 'alias',
      type: BindingType.ALIAS,
      canonicalId: Foo,
    });

    kernel.addBinding({
      id: Bar,
      type: BindingType.INSTANCE,
      constructor: Bar,
      paramInjectionMetadata: [
        {id: Foo, index: 0, optional: false, transform: untransformed},
        {id: 'alias', index: 1, optional: false, transform: untransformed},
      ],
      scope: Scope.SINGLETON,
    });

    const result = kernel.resolve(Bar);
    expect(result.param1).toBeInstanceOf(Foo);
    expect(result.param2).toBeInstanceOf(Foo);
    expect(result.param2).toBe(result.param1);
  });

  test('circular dependency', () => {
    class Foo {}

    class Bar {}

    const kernel = new Kernel();

    kernel.addBinding({
      id: Foo,
      type: BindingType.INSTANCE,
      constructor: Foo,
      paramInjectionMetadata: [{id: Bar, index: 0, optional: false, transform: untransformed}],
      scope: Scope.SINGLETON,
    });
    kernel.addBinding({
      id: Bar,
      type: BindingType.INSTANCE,
      constructor: Bar,
      paramInjectionMetadata: [{id: Foo, index: 0, optional: false, transform: untransformed}],
      scope: Scope.SINGLETON,
    });

    expect(() => kernel.resolve(Foo)).toThrow();
  });

  test('circular alias', () => {
    const kernel = new Kernel();
    kernel.addBinding({
      type: BindingType.ALIAS,
      id: 'foo',
      canonicalId: 'foo',
    });

    expect(() => kernel.resolve('foo')).toThrow();
  });

  test('scope', () => {
    const kernel = new Kernel();

    class GlobalSingleton {
      constructor() {}
    }

    kernel.addBinding({
      id: GlobalSingleton,
      type: BindingType.INSTANCE,
      constructor: GlobalSingleton,
      paramInjectionMetadata: [],
      scope: Scope.SINGLETON,
    });

    class RequestSingleton {
      constructor(readonly param1: GlobalSingleton) {}
    }

    kernel.addBinding({
      id: RequestSingleton,
      type: BindingType.INSTANCE,
      constructor: RequestSingleton,
      paramInjectionMetadata: [{id: GlobalSingleton, index: 0, optional: false, transform: untransformed}],
      scope: Scope.REQUEST,
    });

    class Transient {
      constructor(readonly param1: GlobalSingleton, readonly param2: RequestSingleton) {}
    }

    kernel.addBinding({
      id: Transient,
      type: BindingType.INSTANCE,
      constructor: Transient,
      paramInjectionMetadata: [
        {id: GlobalSingleton, index: 0, optional: false, transform: untransformed},
        {id: RequestSingleton, index: 1, optional: false, transform: untransformed},
      ],
      scope: Scope.TRANSIENT,
    });

    class Root {
      constructor(readonly param1: Transient, readonly param2: Transient) {}
    }

    kernel.addBinding({
      id: Root,
      type: BindingType.INSTANCE,
      constructor: Root,
      paramInjectionMetadata: [
        {id: Transient, index: 0, optional: false, transform: untransformed},
        {id: Transient, index: 1, optional: false, transform: untransformed},
      ],
      scope: Scope.TRANSIENT,
    });

    const root = kernel.resolve(Root);
    expect(root.param1).toBeInstanceOf(Transient);
    expect(root.param2).toBeInstanceOf(Transient);
    expect(root.param1).not.toBe(root.param2);
    expect(root.param1.param1).toBeInstanceOf(GlobalSingleton);
    expect(root.param2.param1).toBeInstanceOf(GlobalSingleton);
    expect(root.param1.param1).toBe(root.param2.param1);
    expect(root.param1.param2).toBe(root.param2.param2);
  });
});
