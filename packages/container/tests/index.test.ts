import {
  BindingNotFoundError,
  BindingType,
  CircularAliasError,
  CircularDependencyError,
  Container,
  DuplicatedBindingError,
  injectable,
  inject,
  InvalidParamBindingError,
  Scope,
  optional,
} from '../src';

function untransformed(input: any) {
  return input;
}
describe('Kernel', () => {
  test('simple resolve', () => {
    const kernel = new Container();
    const value = 1;

    class Foo {
      constructor(readonly param: number) {}
    }

    kernel.addBinding({
      type: BindingType.CONSTANT,
      value,
      id: '1',
    });
    const transformer = jest.fn((x) => x);

    kernel.addBinding({
      id: Foo,
      type: BindingType.INSTANCE,
      constructor: Foo,
      paramInjectionMetadata: [{id: '1', index: 0, optional: false, transform: transformer}],
      scope: Scope.SINGLETON,
    });

    const result = kernel.resolve(Foo);
    expect(result).toBeInstanceOf(Foo);
    expect(result.param).toBe(value);
    expect(transformer).toHaveBeenCalledWith(value);
  });

  test('factory', () => {
    const kernel = new Container();
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
      type: BindingType.FACTORY,
      factory: (param: number) => new Foo(param),
      paramInjectionMetadata: [{id: '1', index: 0, optional: false, transform: untransformed}],
      scope: Scope.SINGLETON,
    });

    const result = kernel.resolve(Foo);
    expect(result).toBeInstanceOf(Foo);
    expect(result.param).toBe(value);
  });

  test('optional', () => {
    const kernel = new Container();
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
        {id: '1', index: 0, optional: false},
        {id: 'optional', index: 1, optional: true},
      ],
      scope: Scope.SINGLETON,
    });

    const result = kernel.resolve(Foo);
    expect(result).toBeInstanceOf(Foo);
    expect(result.param).toBe(value);
    expect(result.optional).toBe(undefined);
  });

  test('singleton alias', () => {
    const kernel = new Container();

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
        {id: Foo, index: 0, optional: false},
        {id: 'alias', index: 1, optional: false},
      ],
      scope: Scope.SINGLETON,
    });

    const result = kernel.resolve(Bar);
    expect(result.param1).toBeInstanceOf(Foo);
    expect(result.param2).toBeInstanceOf(Foo);
    expect(result.param2).toBe(result.param1);
  });

  test('no binding', () => {
    const kernel = new Container();
    expect(() => kernel.resolve('aa')).toThrow(BindingNotFoundError);
  });

  test('duplicated', () => {
    const kernel = new Container();
    kernel.addBinding({
      type: BindingType.ALIAS,
      id: 'duplicated',
      canonicalId: 'canonicalId',
    });
    expect(() =>
      kernel.addBinding({
        type: BindingType.ALIAS,
        id: 'duplicated',
        canonicalId: 'canonicalId',
      }),
    ).toThrow(DuplicatedBindingError);
  });

  test('invalid param injection metadata', () => {
    const kernel = new Container();
    class Foo {}
    expect(() =>
      kernel.addBinding({
        type: BindingType.INSTANCE,
        id: Foo,
        paramInjectionMetadata: [
          {
            index: 1,
            id: 'foo',
            optional: true,
          },
        ],
        scope: Scope.TRANSIENT,
        constructor: Foo,
      }),
    ).toThrow(InvalidParamBindingError);
  });

  test('circular dependency', () => {
    class Foo {}

    class Bar {}

    const kernel = new Container();

    kernel.addBinding({
      id: Foo,
      type: BindingType.INSTANCE,
      constructor: Foo,
      paramInjectionMetadata: [{id: Bar, index: 0, optional: false}],
      scope: Scope.SINGLETON,
    });
    kernel.addBinding({
      id: Bar,
      type: BindingType.INSTANCE,
      constructor: Bar,
      paramInjectionMetadata: [{id: Foo, index: 0, optional: false}],
      scope: Scope.SINGLETON,
    });

    expect(() => kernel.resolve(Foo)).toThrow(CircularDependencyError);
  });

  test('circular alias', () => {
    const kernel = new Container();
    kernel.addBinding({
      type: BindingType.ALIAS,
      id: 'foo',
      canonicalId: 'foo',
    });

    expect(() => kernel.resolve('foo')).toThrow(CircularAliasError);
  });

  test('async resolve', async () => {
    const kernel = new Container();
    const value1 = Math.random();
    const value2 = Math.random();

    class Foo {
      bar;

      constructor(param1: number, param2: number) {
        this.bar = param1 + param2;
      }
    }

    kernel.addBinding({
      type: BindingType.CONSTANT,
      id: 'constant',
      value: value1,
    });
    kernel.addBinding<number>({
      type: BindingType.ASYNC_FACTORY,
      id: 'provider1',
      factory: async () => value2,
      paramInjectionMetadata: [],
      scope: Scope.REQUEST,
    });
    kernel.addBinding({
      type: BindingType.INSTANCE,
      id: Foo,
      constructor: Foo,
      paramInjectionMetadata: [
        {id: 'constant', optional: false, index: 0, transform: untransformed},
        {id: 'provider1', optional: false, index: 1},
      ],
      scope: Scope.REQUEST,
    });
    const result = await kernel.resolveAsync(Foo);
    expect(result.bar).toEqual(value1 + value2);
  });

  test('interceptor', async () => {
    const kernel = new Container();
    const value1 = Math.random();
    const value2 = Math.random();
    const value3 = Math.random();
    const postNext1 = jest.fn();
    const postNext2 = jest.fn();
    kernel.addBinding({
      type: BindingType.CONSTANT,
      id: 'constant',
      value: value1,
    });
    kernel.addBinding<number>({
      type: BindingType.ASYNC_FACTORY,
      id: 'async_factory',
      factory: async (param1, param2) => param1 + param2,
      paramInjectionMetadata: [
        {
          id: 'constant',
          index: 0,
          optional: false,
        },
        {
          id: 'interceptor2',
          index: 1,
          optional: false,
        },
      ],
      scope: Scope.REQUEST,
    });

    const context = kernel.createResolveContext();

    const result = await context.resolveAsync('async_factory', {
      interceptors: [
        {
          interceptorBuilder: (param1: number) => {
            return async (next) => {
              context.addTemporaryConstantBinding('interceptor1', value2);
              await next();
              postNext1(param1);
            };
          },
          paramInjectionMetadata: [{id: 'constant', index: 0, optional: false}],
        },

        {
          interceptorBuilder: (param1: number) => {
            return async (next) => {
              context.addTemporaryConstantBinding('interceptor2', param1 + value3);
              await next();
              postNext2(param1);
            };
          },
          paramInjectionMetadata: [{id: 'interceptor1', index: 0, optional: false}],
        }
      ]
    });
    expect(result).toEqual(value1 + value2 + value3);
    expect(postNext1).not.toHaveBeenCalled();
    expect(postNext2).not.toHaveBeenCalled();
    await context.cleanUp();
    expect(postNext1).toHaveBeenCalled();
    expect(postNext2).toHaveBeenCalled();
  });

  test('scope', () => {
    const kernel = new Container();

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
      type: BindingType.FACTORY,
      factory: (a: Transient, b: Transient) => new Root(a, b),
      paramInjectionMetadata: [
        {id: Transient, index: 0, optional: false, transform: untransformed},
        {id: Transient, index: 1, optional: false, transform: untransformed},
      ],
      scope: Scope.REQUEST,
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

  test('decorator', () => {
    @injectable({scope: Scope.SINGLETON})
    class Foo {
      constructor() {}
    }

    @injectable()
    class X {
      constructor(@inject(Foo) readonly foo: Foo, @optional() @inject('optional') optional?: any) {}
    }

    const container = new Container();
    container.add(Foo);
    container.add(X);
    const x = container.resolve(X);
    const y = container.resolve(X);
    expect(x.foo).toBeInstanceOf(Foo);
    expect(y.foo).toBe(y.foo);
  });
});
