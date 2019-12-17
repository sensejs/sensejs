import {Container, inject, injectable} from 'inversify';
import {
  Component,
  invokeMethod,
  Inject,
  ParamBindingError,
  ParamBindingResolvingError,
  validateFunctionParamBindingMetadata,
} from '../src';

describe('@Inject', () => {
  test('param binding', () => {
    const x = Symbol(),
      y = Symbol();
    class Foo {
      bar(@Inject(x) param: string, @Inject(y, {transform: (x: number) => x + 1}) number: number) {
        return param.repeat(number);
      }
    }

    const container = new Container();
    const constValue = 'deadbeef';
    container.bind(x).toConstantValue(constValue);
    container.bind(y).toConstantValue(2);
    expect(invokeMethod(container, new Foo(), Foo.prototype.bar)).toBe(constValue.repeat(3));
  });

  test('Validate param binding', () => {
    const x = Symbol();
    class Foo {
      shouldOkay(@Inject(x) foo: any) {}

      shouldFail(foo: any) {}

      noParam() {}
    }
    expect(() => validateFunctionParamBindingMetadata(Foo.prototype.shouldOkay)).not.toThrow();
    expect(() => validateFunctionParamBindingMetadata(Foo.prototype.shouldFail)).toThrow();
    expect(() => validateFunctionParamBindingMetadata(Foo.prototype.noParam)).not.toThrow();
  });

  test('Duplicated param binding', () => {
    const x = Symbol(),
      y = Symbol();
    expect(() => {
      class Foo {
        bar(@Inject(x) @Inject(y) foo: any) {}
      }
    }).toThrow(ParamBindingError);
  });

  test('Missing @Inject', () => {
    class Foo {
      bar(param: string) {
        return param;
      }
    }

    const container = new Container();
    container.bind(String).toConstantValue('deadbeef');
    expect(() => invokeMethod(container, new Foo(), Foo.prototype.bar)).toThrow(ParamBindingResolvingError);
  });

  test('Inconsistent param binding', () => {
    class Foo {
      bar(undecorated: string, param: string) {
        return param;
      }
    }

    const container = new Container();

    container.bind(String).toConstantValue('deadbeef');
    expect(() => invokeMethod(container, new Foo(), Foo.prototype.bar)).toThrow(ParamBindingResolvingError);

    Inject(String)(Foo.prototype, 'bar', 1);
    expect(() => invokeMethod(container, new Foo(), Foo.prototype.bar)).toThrow(ParamBindingResolvingError);

    Inject(String)(Foo.prototype, 'bar', 2);
    expect(() => invokeMethod(container, new Foo(), Foo.prototype.bar)).toThrow(ParamBindingResolvingError);
  });

  test('Performance test', () => {
    const x = Symbol(),
      y = Symbol();

    @Component()
    class Test {}

    const container = new Container();
    container.bind(x).toConstantValue('deadbeef');
    container.bind(y).toConstantValue(2);
    let constructor: any;
    for (let i = 0; i < 10000; i++) {
      if (i % 100) {
        container.bind(Symbol()).toConstantValue(i);
        continue;
      }
      if (constructor) {
        @injectable()
        class X {
          constructor(@inject(constructor) private empty: any) {}
        }

        container.bind(X).to(X);
        constructor = X;
      } else {
        @injectable()
        class X {
          constructor() {}
        }

        container.bind(X).to(X);
        constructor = X;
      }
    }

    @Component()
    class Foo {
      bar(
        @Inject(x, {transform: (x: string) => x.repeat(2)}) param: string,
        @Inject(y, {transform: (x: number) => x * x}) number: number,
        @Inject(Test) test: Test,
        @Inject(constructor) x: any,
      ) {
        return param.repeat(number);
      }
    }

    container.bind(Foo).toSelf();

    let N = 1000;
    // 10000 method invoking should be done within 30s
    while (N--) {
      const childContainer = container.createChild();
      for (let i = 0; i < 1000; i++) {
        childContainer.bind(Symbol()).toConstantValue(i);
      }
      childContainer.bind(Test).toConstantValue(new Test());
      invokeMethod(childContainer, childContainer.get(Foo), Foo.prototype.bar);
    }
  }, 10000);
});
