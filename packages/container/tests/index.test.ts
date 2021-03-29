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
  NoEnoughInjectMetadataError,
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

  test('invoke', async () => {
    const kernel = new Container();
    const value1 = Math.random();
    const value2 = Math.random();

    class Foo {
      bar;

      constructor(@inject('const1') readonly param1: number) {
        this.bar = param1;
      }

      method(@inject('const2') value: number, @inject('temp2') value2: number) {
        expect(value + this.param1).toEqual(value2);
      }
    }

    const methodSpy = jest.spyOn(Foo.prototype, 'method');

    kernel.add(Foo);
    kernel.addBinding({
      type: BindingType.CONSTANT,
      id: 'const1',
      value: value1,
    });
    kernel.addBinding<number>({
      type: BindingType.CONSTANT,
      id: 'const2',
      value: value2,
    });
    const context = await kernel.createResolveContext().setAllowUnbound(true);
    await context.intercept({
      interceptorBuilder: (param1: number) => {
        return async (next) => {
          context.addTemporaryConstantBinding('temp1', param1);
          await next();
        };
      },
      paramInjectionMetadata: [{id: 'const1', index: 0, optional: false}],
    });
    await context.intercept({
      interceptorBuilder: (param1: number, param2: number) => {
        return async (next) => {
          context.addTemporaryConstantBinding('temp2', param1 + param2);
          await next();
        };
      },
      paramInjectionMetadata: [
        {id: 'temp1', index: 0, optional: false},
        {id: 'const2', index: 1, optional: false},
      ],
    });
    await context.invoke(Foo, 'method');
    expect(methodSpy).toHaveBeenCalled();
    await context.cleanUp();
  });

  test('invalid invoke', () => {
    const kernel = new Container();

    class Foo {
      constructor() {}

      method(@inject('const2') param1: number, param2: number) {}
    }

    expect(() => kernel.createResolveContext().setAllowUnbound(true).invoke(Foo, 'method')).toThrow(
      NoEnoughInjectMetadataError,
    );
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
      constructor(@inject(Foo) readonly foo: Foo, @optional() @inject('optional') optionalParam?: any) {}
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
