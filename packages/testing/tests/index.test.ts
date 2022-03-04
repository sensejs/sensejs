import '@sensejs/testing-utility/lib/mock-console.js';
import {Component, Inject, ModuleClass, OnModuleCreate} from '@sensejs/core';
import {MockApplicationRunner} from '../src/index.js';

test('MockAppRunner', () => {
  @Component()
  class MyComponent {}

  @ModuleClass()
  class MyApp {
    @OnModuleCreate()
    onInit(@Inject(MyComponent) myComponent: MyComponent) {
      expect(myComponent).toBeInstanceOf(MyComponent);
    }
  }

  const runner = new MockApplicationRunner();
  runner.loader().mockModule(MyApp, (moduleMetadata) => {
    moduleMetadata.components.push(MyComponent);
    return moduleMetadata;
  });

  return new Promise((resolve) => {
    runner.runModule(MyApp, {onExit: resolve});
    setTimeout(() => {
      runner.emitSignal('SIGINT');
    }, 100);
  });
});
