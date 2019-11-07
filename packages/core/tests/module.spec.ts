import 'reflect-metadata';
import {Container, inject} from 'inversify';
import {Component, ComponentFactory, getModuleMetadata, Module, ModuleClass} from '../src';
import {ModuleInstance} from '../src/module-instance';

describe('Module', () => {
  test('@Module', async () => {
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

    const TestModule = Module({
      components: [TestComponent],
      constants: [{provide: ConstantSymbol, value: constant}],
      factories: [{provide: FactorySymbol, factory: Factory}],
    });

    getModuleMetadata(TestModule);
    const container = new Container();
    await new ModuleInstance(TestModule, container).onSetup();
    await new TestModule().onCreate();
    expect(container.get(TestComponent)).toBeInstanceOf(TestComponent);
    expect(componentSpy).toHaveBeenCalledWith(constant, -constant);
  });

  test('useFactory', async () => {});

  test('getModuleMetadata', () => {
    class NonModule extends ModuleClass {
      async onCreate(): Promise<void> {}

      async onDestroy(): Promise<void> {}
    }

    expect(() => new ModuleInstance(NonModule, new Container())).toThrow();
  });
});
