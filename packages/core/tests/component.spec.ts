import {Component, ComponentScope, getComponentMetadata, Scope} from '../src/index.js';

describe('Component', () => {
  test('getComponent', async () => {
    @Component()
    class MyComponent {}

    expect(getComponentMetadata(MyComponent)).toEqual(expect.objectContaining({target: MyComponent, id: MyComponent}));

    class NonComponent {}

    expect(() => getComponentMetadata(NonComponent)).toThrow();
  });

  test('Component using string as id', async () => {
    const id = Date.now().toString();

    @Component({id})
    class MyComponent {}

    expect(getComponentMetadata(MyComponent)).toEqual(expect.objectContaining({target: MyComponent, id}));
  });

  test('Component using symbol as id', async () => {
    const id = Symbol();

    @Component({id})
    class MyComponent {}

    expect(getComponentMetadata(MyComponent)).toEqual(expect.objectContaining({target: MyComponent, id}));
  });

  test('Component using abstract as id', async () => {
    abstract class BaseClass {}

    @Component({id: BaseClass})
    class MyComponent extends BaseClass {}

    expect(getComponentMetadata(MyComponent)).toEqual(expect.objectContaining({target: MyComponent, id: BaseClass}));
  });

  test('Failed to use unrelated function as component id', () => {
    expect(() => {
      class AnyOtherClass {}

      @Component({id: AnyOtherClass})
      class MyComponent {}
    }).toThrow();
  });

  test('Cannot apply @Component to same target multiple times', () => {
    expect(() => {
      @Component()
      @Component()
      class MyComponent {}
    });
    expect(() => {
      @Component({id: Symbol()})
      @Component()
      class MyComponent {}
    });
  });

  test('Component explicit using self as component id', async () => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    @Component({id: MyComponent})
    class MyComponent {}

    expect(getComponentMetadata(MyComponent)).toEqual(expect.objectContaining({target: MyComponent, id: MyComponent}));
  });
});
