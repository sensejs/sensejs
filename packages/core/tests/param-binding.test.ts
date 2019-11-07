import 'reflect-metadata';
import {Component, invokeMethod, ParamBinding, ParamBindingError, ParamBindingResolvingError} from '../src';
import {Container, inject, injectable} from 'inversify';

describe('@ParamBinding', () => {
  test('param binding', () => {
    class Foo {
      bar(@ParamBinding(String) param: string, @ParamBinding(Number, {transform: (x) => x + 1}) number: number) {
        return param.repeat(number);
      }
    }

    const container = new Container();
    const constValue = 'deadbeef';
    container.bind(String).toConstantValue(constValue);
    container.bind(Number).toConstantValue(2);
    expect(invokeMethod(container, new Foo(), Foo.prototype.bar)).toBe(constValue.repeat(3));
  });

  test('Duplicated param binding', () => {
    expect(() => {
      class Foo {
        bar(@ParamBinding(String) @ParamBinding(Number) foo: any) {}
      }
    }).toThrow(ParamBindingError);
  });

  test('Missing @ParamBinding', () => {
    class Foo {
      bar(param: string) {
        return param;
      }
    }

    const container = new Container();
    container.bind(String).toConstantValue('deadbeef');
    expect(() => invokeMethod(container, new Foo(), Foo.prototype.bar)).toThrow(ParamBindingResolvingError);
  });

  test('Missing @ParamBinding', () => {
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

    ParamBinding(String)(Foo.prototype, 'bar', 1);
    expect(() => invokeMethod(container, new Foo(), Foo.prototype.bar)).toThrow(ParamBindingResolvingError);

    ParamBinding(String)(Foo.prototype, 'bar', 2);
    expect(() => invokeMethod(container, new Foo(), Foo.prototype.bar)).toThrow(ParamBindingResolvingError);
  });

  test('Performance test', () => {
    @Component()
    class Test {}

    const container = new Container();
    container.bind(String).toConstantValue('deadbeef');
    container.bind(Number).toConstantValue(2);
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
        @ParamBinding(String, {transform: (x: string) => x.repeat(2)}) param: string,
        @ParamBinding(Number, {transform: (x: number) => x * x}) number: number,
        @ParamBinding(Test) test: Test,
        @ParamBinding(constructor) x: any,
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
