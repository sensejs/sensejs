import {Component, ComponentMetadata, getComponentMetadata, Named, Tagged} from '../src';
import {AsyncContainerModule, Container} from 'inversify';
//
// async function mockBind<T>(metadata: ComponentMetadata<T>) {
//   const container: Container = new Container({skipBaseClassChecks: true});
//   container.load(
//     new AsyncContainerModule(async (bind, unbind, isBound, rebind) => {
//       await metadata.onBind(bind, unbind, isBound, rebind);
//     }),
//   );
//   return container;
// }

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

    const metadata = getComponentMetadata(MyComponent);
    // const container = await mockBind(metadata);
    // expect(container.get(id)).toBeInstanceOf(MyComponent);
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

    const metadata = getComponentMetadata(MyComponent);
    expect(getComponentMetadata(MyComponent)).toEqual(expect.objectContaining({target: MyComponent, id: BaseClass}));
  });
  test('Component explicit using self as component id', async () => {
    @Component({id: MyComponent})
    class MyComponent {}

    expect(getComponentMetadata(MyComponent)).toEqual(expect.objectContaining({target: MyComponent, id: MyComponent}));
  });

  test('Named component', () => {
    const name = `name-${Date.now()}`;

    @Component()
    @Named(name)
    class MyComponent {}

    expect(getComponentMetadata(MyComponent)).toEqual(expect.objectContaining({name}));
  });

  test('Tagged component', () => {
    const numberTagKey = 0;
    const numberTagValue = Date.now();
    const stringTagKey = `tag_${Date.now()}`;
    const stringTagValue = `value_${Date.now()}`;
    const symbolTagKey = Symbol(`symbol_${Date.now()}`);
    const symbolTagValue = `value_${Date.now()}`;

    @Component()
    @Tagged(numberTagKey, numberTagValue)
    @Tagged(stringTagKey, stringTagValue)
    @Tagged(symbolTagKey, symbolTagValue)
    class MyComponent {}

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
});
