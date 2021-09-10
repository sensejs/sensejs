import {
  BindingNotFoundError,
  BindingType,
  CircularAliasError,
  CircularDependencyError,
  Container,
  DuplicatedBindingError,
  inject,
  Injectable,
  injectable,
  InjectScope,
  InvalidParamBindingError,
  NoEnoughInjectMetadataError,
  optional,
  scope,
} from '../src';

function untransformed(input: any) {
  return input;
}
describe('Container', () => {
  test('simple resolve', () => {
    const container = new Container();
    const value = 1;

    class Foo {
      constructor(readonly param: number) {}
    }

    container.addBinding({
      type: BindingType.CONSTANT,
      value,
      id: '1',
    });
    const transformer = jest.fn((x) => x);

    container.addBinding({
      id: Foo,
      type: BindingType.INSTANCE,
      constructor: Foo,
      paramInjectionMetadata: [{id: '1', index: 0, optional: false, transform: transformer}],
      scope: InjectScope.SINGLETON,
    });
    container.compile();

    const result = container.resolve(Foo);
    expect(result).toBeInstanceOf(Foo);
    expect(result.param).toBe(value);
    expect(transformer).toHaveBeenCalledWith(value);
  });

  test('construct', () => {
    const container = new Container();
    const value = '1';
    container.addBinding({
      type: BindingType.CONSTANT,
      value,
      id: '1',
    });
    container.compile();

    class Foo {
      constructor(@inject('1') readonly param: number) {}
    }

    class Bar {
      constructor(@inject('2') readonly param: number) {}
    }

    expect(container.createResolveSession().construct(Foo)).toEqual(expect.objectContaining({param: value}));

    expect(() => container.createResolveSession().construct(Bar)).toThrow(BindingNotFoundError);
  });

  test('factory', () => {
    const container = new Container();
    const value = 1;

    class Foo {
      constructor(readonly param: number) {}
    }

    container.addBinding({
      type: BindingType.CONSTANT,
      value,
      id: '1',
    });

    container.addBinding({
      id: Foo,
      type: BindingType.FACTORY,
      factory: (param: number) => new Foo(param),
      paramInjectionMetadata: [{id: '1', index: 0, optional: false, transform: untransformed}],
      scope: InjectScope.SINGLETON,
    });

    container.compile();

    const result = container.resolve(Foo);
    expect(result).toBeInstanceOf(Foo);
    expect(result.param).toBe(value);
  });

  test('optional', () => {
    const container = new Container();
    const value = 1;

    class Foo {
      constructor(readonly param: number, readonly optional?: any) {}
    }

    container.addBinding({
      type: BindingType.CONSTANT,
      value,
      id: '1',
    });

    container.addBinding({
      id: Foo,
      type: BindingType.INSTANCE,
      constructor: Foo,
      paramInjectionMetadata: [
        {id: '1', index: 0, optional: false},
        {id: 'optional', index: 1, optional: true},
      ],
      scope: InjectScope.SINGLETON,
    });
    container.compile();

    const result = container.resolve(Foo);
    expect(result).toBeInstanceOf(Foo);
    expect(result.param).toBe(value);
    expect(result.optional).toBe(undefined);
  });

  test('singleton alias', () => {
    const container = new Container();

    class Foo {
      constructor() {}
    }

    class Bar {
      constructor(readonly param1: any, readonly param2: any) {}
    }

    container.addBinding({
      id: Foo,
      type: BindingType.INSTANCE,
      constructor: Foo,
      paramInjectionMetadata: [],
      scope: InjectScope.SINGLETON,
    });

    container.addBinding({
      id: 'alias',
      type: BindingType.ALIAS,
      canonicalId: Foo,
    });

    container.addBinding({
      id: Bar,
      type: BindingType.INSTANCE,
      constructor: Bar,
      paramInjectionMetadata: [
        {id: Foo, index: 0, optional: false},
        {id: 'alias', index: 1, optional: false},
      ],
      scope: InjectScope.SINGLETON,
    });
    container.compile();

    const result = container.resolve(Bar);
    expect(result.param1).toBeInstanceOf(Foo);
    expect(result.param2).toBeInstanceOf(Foo);
    expect(result.param2).toBe(result.param1);
  });

  test('no binding', () => {
    const kernel = new Container();
    expect(() => kernel.resolve('aa')).toThrow(BindingNotFoundError);
  });

  test('duplicated', () => {
    const container = new Container();
    container.addBinding({
      type: BindingType.CONSTANT,
      id: 'duplicated',
      value: 'duplicated',
    });
    expect(() =>
      container.addBinding({
        type: BindingType.ALIAS,
        id: 'duplicated',
        canonicalId: 'canonicalId',
      }),
    ).toThrow(DuplicatedBindingError);
    container.compile();
    expect(() =>
      container.addBinding({
        type: BindingType.ALIAS,
        id: 'duplicated',
        canonicalId: 'canonicalId',
      }),
    ).toThrow(DuplicatedBindingError);
  });

  test('invalid param injection metadata', () => {
    const container = new Container();
    class Foo {}
    expect(() =>
      container
        .addBinding({
          type: BindingType.INSTANCE,
          id: Foo,
          paramInjectionMetadata: [
            {
              index: 1,
              id: 'foo',
              optional: true,
            },
          ],
          scope: InjectScope.TRANSIENT,
          constructor: Foo,
        })
        .compile(),
    ).toThrow(InvalidParamBindingError);
  });

  test('circular dependency', () => {
    class Foo {}

    class Bar {}

    const container = new Container();

    container.addBinding({
      id: Foo,
      type: BindingType.INSTANCE,
      constructor: Foo,
      paramInjectionMetadata: [{id: Bar, index: 0, optional: false}],
      scope: InjectScope.SINGLETON,
    });
    container.addBinding({
      id: Bar,
      type: BindingType.INSTANCE,
      constructor: Bar,
      paramInjectionMetadata: [{id: Foo, index: 0, optional: false}],
      scope: InjectScope.SINGLETON,
    });

    expect(() => container.compile()).toThrow(CircularDependencyError);
  });

  test('circular alias', () => {
    const container = new Container();
    container.addBinding({
      type: BindingType.ALIAS,
      id: 'foo',
      canonicalId: 'foo',
    });

    expect(() => container.compile()).toThrow(CircularAliasError);
  });

  test('invoke', async () => {
    const container = new Container();
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

    container.add(Foo);
    container.addBinding({
      type: BindingType.CONSTANT,
      id: 'const1',
      value: value1,
    });
    container.addBinding<number>({
      type: BindingType.CONSTANT,
      id: 'const2',
      value: value2,
    });
    container.compile();
    const context = await container.createResolveSession();
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
    const container = new Container();

    class Foo {
      constructor() {}

      method(@inject('const2') param1: number, param2: number) {}
    }
    container.add(Foo);
    container.compile();
    expect(() => container.createResolveSession().invoke(Foo, 'method')).toThrow(NoEnoughInjectMetadataError);
  });

  test('invoke with optional', () => {
    const container = new Container();

    class Foo {
      constructor() {}

      method(@optional() @inject('const') param1?: number) {}
    }
    container.add(Foo).compile();

    container.createResolveSession().invoke(Foo, 'method');
  });

  test('error occurred when invoke', async () => {
    const container = new Container();

    class FooError extends Error {}

    class Foo {
      constructor() {}

      method() {
        throw new FooError();
      }
    }

    container.add(Foo);
    container.compile();
    const stub = jest.fn();
    const context = container.createResolveSession();
    await context.intercept({
      interceptorBuilder: () => {
        return async (next) => {
          try {
            await next();
          } catch (e) {
            stub(e);
            throw e;
          }
        };
      },
      paramInjectionMetadata: [],
    });
    let err;
    expect(() => {
      try {
        context.invoke(Foo, 'method');
      } catch (e) {
        err = e;
        throw e;
      }
    }).toThrow(FooError);

    expect(stub).not.toHaveBeenCalled();
    await expect(context.cleanUp(err)).rejects.toBeInstanceOf(FooError);
    expect(stub).toHaveBeenCalled();
  });

  test('interceptor throw', async () => {
    const container = new Container();

    class Foo {
      constructor() {}

      method() {}
    }

    container.add(Foo);
    container.compile();
    const context = container.createResolveSession();
    await context.intercept({
      interceptorBuilder: () => {
        return async (next) => {
          await next();
          throw new Error();
        };
      },
      paramInjectionMetadata: [],
    });
    context.invoke(Foo, 'method');
    await expect(context.cleanUp()).rejects.toBeInstanceOf(Error);
  });

  test('scope', () => {
    const container = new Container();

    class GlobalSingleton {
      constructor() {}
    }

    container.addBinding({
      id: GlobalSingleton,
      type: BindingType.INSTANCE,
      constructor: GlobalSingleton,
      paramInjectionMetadata: [],
      scope: InjectScope.SINGLETON,
    });

    class RequestSingleton {
      constructor(readonly param1: GlobalSingleton) {}
    }

    container.addBinding({
      id: RequestSingleton,
      type: BindingType.INSTANCE,
      constructor: RequestSingleton,
      paramInjectionMetadata: [{id: GlobalSingleton, index: 0, optional: false, transform: untransformed}],
      scope: InjectScope.SESSION,
    });

    class Transient {
      constructor(readonly param1: GlobalSingleton, readonly param2: RequestSingleton) {}
    }

    container.addBinding({
      id: Transient,
      type: BindingType.INSTANCE,
      constructor: Transient,
      paramInjectionMetadata: [
        {id: GlobalSingleton, index: 0, optional: false, transform: untransformed},
        {id: RequestSingleton, index: 1, optional: false, transform: untransformed},
      ],
      scope: InjectScope.TRANSIENT,
    });

    class Root {
      constructor(readonly param1: Transient, readonly param2: Transient) {}
    }

    container.addBinding({
      id: Root,
      type: BindingType.FACTORY,
      factory: (a: Transient, b: Transient) => new Root(a, b),
      paramInjectionMetadata: [
        {id: Transient, index: 0, optional: false, transform: untransformed},
        {id: Transient, index: 1, optional: false, transform: untransformed},
      ],
      scope: InjectScope.SESSION,
    });
    container.compile();

    const root = container.resolve(Root);
    expect(root.param1).toBeInstanceOf(Transient);
    expect(root.param2).toBeInstanceOf(Transient);
    expect(root.param1).not.toBe(root.param2);
    expect(root.param1.param1).toBeInstanceOf(GlobalSingleton);
    expect(root.param2.param1).toBeInstanceOf(GlobalSingleton);
    expect(root.param1.param1).toBe(root.param2.param1);
    expect(root.param1.param2).toBe(root.param2.param2);
  });

  test('decorator', () => {
    @injectable({scope: InjectScope.SINGLETON})
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
    container.compile();
    const x = container.resolve(X);
    const y = container.resolve(X);
    expect(x.foo).toBeInstanceOf(Foo);
    expect(y.foo).toBe(y.foo);
  });

  test('temporary binding cannot be used by global component', () => {
    const container = new Container();
    const stub = jest.fn();
    @injectable()
    @scope(InjectScope.SINGLETON)
    class GlobalB {
      constructor() {}
    }
    @injectable()
    @scope(InjectScope.SINGLETON)
    class GlobalA {
      constructor(@inject(GlobalB) readonly param: any) {}
    }

    @injectable()
    @scope(InjectScope.TRANSIENT)
    class A {
      constructor(@inject(GlobalA) readonly global: GlobalA) {}
    }

    const temporaryGlobalB = new GlobalB();
    let singletonB: any;
    @injectable()
    @scope(InjectScope.SESSION)
    class B {
      foo(@inject(A) a: A) {
        expect(a.global.param).toBeInstanceOf(GlobalB);
        if (singletonB) {
          expect(a.global.param).toBe(singletonB);
          expect(a.global.param).not.toBe(temporaryGlobalB);
          stub(singletonB);
        } else {
          singletonB = a.global.param;
          stub();
        }
      }
    }
    container.add(GlobalA);
    container.add(GlobalB);
    container.add(A);
    container.add(B);
    container.compile();
    expect(container.resolve(A)).toBeInstanceOf(A);
    container.createResolveSession().invoke(B, 'foo');
    expect(stub).toHaveBeenCalledTimes(1);
    expect(stub).toHaveBeenLastCalledWith();
    container.createResolveSession().addTemporaryConstantBinding(GlobalB, temporaryGlobalB).invoke(B, 'foo');
    expect(stub).toHaveBeenCalledTimes(2);
    expect(stub).toHaveBeenLastCalledWith(singletonB);
  });

  test('deprecated createResolveContext works', () => {
    @injectable()
    class A {}
    @injectable({scope: InjectScope.REQUEST})
    class B {}

    const container = new Container();
    expect(container.add(A).compile().createResolveContext().resolve(A)).toBeInstanceOf(A);
    container.add(B).compile();
    expect(container.resolve(B)).not.toBe(container.resolve(B));
    const resolveContext = container.createResolveContext();
    expect(resolveContext.resolve(B)).toBe(resolveContext.resolve(B));
  });

  test('@injectable deprecated scope option', () => {
    @injectable({scope: InjectScope.SINGLETON})
    class SingletonA {}
    @injectable({scope: InjectScope.REQUEST})
    @scope(InjectScope.SINGLETON)
    class SingletonB {}

    const container = new Container();
    container.add(SingletonA).add(SingletonB).compile();

    expect(container.resolve(SingletonA)).toBe(container.resolve(SingletonA));
    expect(container.resolve(SingletonB)).toBe(container.resolve(SingletonB));
  });

  test('aliased by injectable parent', () => {
    @Injectable()
    class ParentA {}

    class ParentB {}

    class ChildA extends ParentA {}
    class ChildB extends ParentB {}

    const container = new Container();
    container.add(ChildA).add(ChildB).compile();
    expect(container.resolve(ChildA)).toBeInstanceOf(ChildA);
    expect(container.resolve(ChildA)).toBeInstanceOf(ParentA);
    expect(container.resolve(ParentA)).toBeInstanceOf(ParentA);
    expect(container.resolve(ChildB)).toBeInstanceOf(ChildB);
    expect(container.resolve(ChildB)).toBeInstanceOf(ParentB);
    expect(() => container.resolve(ParentB)).toThrow(BindingNotFoundError);
  });
});
