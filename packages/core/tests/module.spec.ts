import {Container, inject, named, tagged} from 'inversify';
import {
  Component,
  ComponentFactory,
  getModuleMetadata,
  Module,
  ModuleClass,
  OnModuleCreate, OnModuleDestroy,
} from '../src';
import {ModuleInstance} from '../src/module-instance';

describe('Module', () => {
  test('@ModuleDecorator', async () => {
    const ConstantSymbol = Symbol();

    const constant = Math.random();

    const FactorySymbol = Symbol();

    class Factory extends ComponentFactory<number> {
      constructor(@inject(ConstantSymbol) private constantValue: number) {
        super();
      }

      build(): number {
        return -this.constantValue;
      }
    }

    const componentSpy = jest.fn();

    @Component()
    class TestComponent {
      constructor(@inject(ConstantSymbol) constantValue: number, @inject(FactorySymbol) factoryValue: number) {
        componentSpy(constantValue, factoryValue);
      }
    }

    @ModuleClass({
      components: [TestComponent],
      constants: [{provide: ConstantSymbol, value: constant}],
      factories: [{provide: FactorySymbol, factory: Factory}],
    })
    class TestModule {

      @OnModuleCreate()
      onModuleCreate() {}

      @OnModuleDestroy()
      onModuleDestroy() {}

    }

    getModuleMetadata(TestModule);
    const container = new Container();
    await new ModuleInstance(TestModule, container).onSetup();
    // await new TestModule().onCreate();
    expect(container.get(TestComponent)).toBeInstanceOf(TestComponent);
    expect(componentSpy).toHaveBeenCalledWith(constant, -constant);
  });

  test('test named', async () => {
    const FactorySymbol = Symbol();
    const value = 'value';
    const factoryName = 'testName';

    class Factory extends ComponentFactory<void> {
      build() {
        return value;
      }
    }

    const TestModule = Module({
      factories: [{provide: FactorySymbol, factory: Factory, name: factoryName}],
    });

    getModuleMetadata(TestModule);
    const container = new Container();
    await new ModuleInstance(TestModule, container).onSetup();
    await new TestModule().onCreate();

    @Component()
    class TestComponent1 {
      constructor(
        @inject(FactorySymbol)
        @named(factoryName)
        private test: any,
      ) {}
    }

    expect(() => container.resolve(TestComponent1)).not.toThrow();
  });

  test('test tagged', async () => {
    const FactorySymbol = Symbol();
    const value = 'value';

    const factoryTag1 = 'tagName1';
    const factoryTag2 = 'tagName2';
    const factoryTagValue1 = 'tagValue1';
    const factoryTagValue2 = 'tagName2';

    class Factory extends ComponentFactory<void> {
      build() {
        return value;
      }
    }

    const TestModule = Module({
      factories: [
        {
          provide: FactorySymbol,
          factory: Factory,
          tags: [
            {key: factoryTag1, value: factoryTagValue1},
            {key: factoryTag2, value: factoryTagValue2},
          ],
        },
      ],
    });

    getModuleMetadata(TestModule);
    const container = new Container();
    await new ModuleInstance(TestModule, container).onSetup();
    await new TestModule().onCreate();

    @Component()
    class TestComponent {
      constructor(@inject(FactorySymbol) @tagged(factoryTag1, factoryTagValue1) private test: any) {}
    }

    expect(() => container.resolve(TestComponent)).toThrow();

    @Component()
    class TestComponent1 {
      constructor(
        @inject(FactorySymbol)
        @tagged(factoryTag1, factoryTagValue1)
        @tagged(factoryTag2, factoryTagValue2)
        private test: any,
      ) {}
    }

    expect(() => container.resolve(TestComponent1)).not.toThrow();
  });
});
