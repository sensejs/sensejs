import {
  Component,
  getComponentMetadata,
  Inject,
  Named,
  Tagged,
  Module,
  ModuleRoot,
  invokeMethod,
  Optional,
} from '../src';
import {Container} from 'inversify';

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

    class MyModule extends Module({components: [X]}) {
      constructor(@Inject(X) x: any) {
        super();
      }
    }

    await new ModuleRoot(MyModule).start();
    expect(stub).toHaveBeenCalledWith(undefined);
  });

  test('Optional method inject', async () => {
    const stub = jest.fn();
    @Component()
    class X {
      constructor(@Inject(injectToken) @Optional() param: any) {
      }
      method(@Inject(injectToken) @Optional() param: any) {
        stub(param);
      }
    }

    class MyModule extends Module({components: [X]}) {
      constructor(@Inject(Container) container: any) {
        super();
        invokeMethod(container, X, X.prototype.method);
      }
    }

    await new ModuleRoot(MyModule).start();
    expect(stub).toHaveBeenCalledWith(undefined);
  });
});

describe('Named', () => {

  const name1 = `name1-${Date.now()}`;
  const name2 = `name2-${Date.now()}`;
  const id = Symbol();

  @Named(name1)
  @Component({id})
  class MyComponent1 {
  }

  @Named(name2)
  @Component({id})
  class MyComponent2 {
  }

  test('Named component', () => {
    expect(getComponentMetadata(MyComponent1)).toEqual(expect.objectContaining({name: name1}));
    expect(getComponentMetadata(MyComponent2)).toEqual(expect.objectContaining({name: name2}));
  });

  test('Method inject', () => {
    const result = Math.random();

    @Component()
    class X {
      callable(@Inject(id) @Named(name1) foo1: MyComponent1, @Inject(id) @Named(name2) foo2: MyComponent2) {
        return result;
      }

      nonCallable(@Inject(id) @Named(name1) foo1: MyComponent1, @Inject(id) @Named(name2) foo2: MyComponent2) {
      }
    }

    class MyModule extends Module({components: [MyComponent1, MyComponent2, X]}) {
      constructor(@Inject(Container) container: Container) {
        super();
        expect(invokeMethod(container, X, X.prototype.callable)).toBe(result);
        expect(() => invokeMethod(container, X, X.prototype.nonCallable)).toThrow();
      }
    }
  });

  test('Named constraint', async () => {

    @Component()
    class Resolvable {
      constructor(
        @Inject(id) @Named(name1) public foo1: MyComponent1,
        @Inject(id) @Named(name2) public foo2: MyComponent2,
      ) {
      }
    }

    @Component()
    class NonResolvable {
      constructor(
        @Inject(id) public foo1: MyComponent1,
        @Inject(id) public foo2: MyComponent2,
      ) {
      }
    }

    class MyModule extends Module({components: [MyComponent1, MyComponent2, Resolvable]}) {

      constructor(@Inject(Container) container: Container) {
        super();
        const injectable = container.get(Resolvable);
        expect(injectable).toBeInstanceOf(Resolvable);
        expect(injectable.foo1).toBeInstanceOf(MyComponent1);
        expect(injectable.foo2).toBeInstanceOf(MyComponent2);
        expect(() => container.get(NonResolvable)).toThrow();
      }
    }

    await new ModuleRoot(MyModule).start();

  });
});

describe('Decorators', () => {

  test('Tagged component', () => {
    const numberTagKey = 0;
    const numberTagValue = Date.now();
    const stringTagKey = `tag_${Date.now()}`;
    const stringTagValue = `value_${Date.now()}`;
    const symbolTagKey = Symbol(`symbol_${Date.now()}`);
    const symbolTagValue = `value_${Date.now()}`;

    @Tagged(numberTagKey, numberTagValue)
    @Tagged(stringTagKey, stringTagValue)
    @Tagged(symbolTagKey, symbolTagValue)
    @Component()
    class MyComponent {
    }

    const x = Tagged('key', 'value');
    x(MyComponent);

    expect(getComponentMetadata(MyComponent)).toEqual(
      expect.objectContaining({
        tags: expect.arrayContaining([
          {key: numberTagKey, value: numberTagValue},
          {key: stringTagKey, value: stringTagValue},
          {key: symbolTagKey, value: symbolTagValue},
        ]),
      }),
    );
  });

  test('Method inject', async () => {
    const result = Math.random();
    const key = Symbol();
    const value = Symbol();

    @Tagged(key, value)
    @Component()
    class Y {
    }

    @Component()
    class X {
      callable(@Inject(Y) @Tagged(key, value) foo1: Y) {
        return result;
      }

      nonCallable(@Inject(Y) foo2: Y) {
      }
    }

    class MyModule extends Module({components: [X, Y]}) {
      constructor(@Inject(Container) container: Container) {
        super();
        expect(invokeMethod(container, X, X.prototype.callable)).toBe(result);
        expect(() => invokeMethod(container, X, X.prototype.nonCallable)).toThrow();
      }
    }

    await new ModuleRoot(MyModule).start();
  });

  test('Tagged constraint', async () => {

    const key1 = Symbol();
    const key2 = Symbol();
    const name1 = `name1-${Date.now()}`;
    const name2 = `name2-${Date.now()}`;
    const id = Symbol();

    @Tagged(key1, name1)
    @Component({id})
    // @Tagged(key2, name1)
    class MyComponent1 {
    }

    @Tagged(key1, name2)
    @Component({id})
    // @Tagged(key2, name2)
    class MyComponent2 {
    }

    @Component()
    class Resolvable1 {
      constructor(
        @Inject(id) @Tagged(key1, name1) public foo1: MyComponent1,
        @Inject(id) @Tagged(key1, name2) public foo2: MyComponent2,
      ) {
      }
    }

    @Component()
    class NonResolvable1 {
      constructor(
        @Inject(id) public foo1: MyComponent1,
        @Inject(id) public foo2: MyComponent2,
      ) {
      }
    }

    @Component()
    class NonResolvable2 {
      constructor(
        @Inject(id) @Tagged(key2, '') public foo1: MyComponent1,
        @Inject(id) @Tagged(key2, '') public foo2: MyComponent2,
      ) {
      }
    }

    class MyModule extends Module({
      components: [
        MyComponent1, MyComponent2, Resolvable1, NonResolvable1, NonResolvable2,
      ],
    }) {

      constructor(@Inject(Container) container: Container) {
        super();
        const resolvable1 = container.get(Resolvable1);
        expect(resolvable1).toBeInstanceOf(Resolvable1);
        expect(resolvable1.foo1).toBeInstanceOf(MyComponent1);
        expect(resolvable1.foo2).toBeInstanceOf(MyComponent2);

        expect(() => container.get(NonResolvable1)).toThrow();
        expect(() => container.get(NonResolvable2)).toThrow();
      }
    }

    await new ModuleRoot(MyModule).start();
  });
});
