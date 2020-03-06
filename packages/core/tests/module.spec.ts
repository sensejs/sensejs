import {Container} from 'inversify';
import {
  Component,
  ComponentFactory,
  getModuleMetadata,
  Inject,
  ModuleClass,
  ModuleRoot,
  Named,
  OnModuleCreate,
  OnModuleDestroy,
  Tagged,
  createModule,
} from '../src';
import {ModuleInstance} from '../src/module-instance';

describe('@ModuleClass', () => {

  test('created module metadata', () => {
    const dependency = createModule();
    expect(getModuleMetadata(createModule({requires: [dependency]}))).toEqual(expect.objectContaining({
      requires: [dependency],
      onModuleCreate: [],
      onModuleDestroy: []
    }));
  });

  test('decorated module metadata', () => {
    @ModuleClass()
    class Y {}

    @ModuleClass({
      requires: [Y],
    })
    class X {
      @OnModuleCreate()
      foo() {}

      @OnModuleCreate()
      onModuleCreate() {}

      @OnModuleDestroy()
      bar() {}

      @OnModuleDestroy()
      onModuleDestroy() {}
    }

    expect(getModuleMetadata(X)).toEqual(expect.objectContaining({
      requires: [Y],
      onModuleCreate: [X.prototype.foo, X.prototype.onModuleCreate],
      onModuleDestroy: [X.prototype.bar, X.prototype.onModuleDestroy]
    }));
  });

});

describe('ModuleInstance', () => {
  const container = new Container();
  const injectToken = Symbol();
  container.bind(injectToken).toConstantValue(Symbol());
  test('Run Module lifecycle', async () => {

    // For unknown reason jest.spy does not work here. Use stub pattern instead
    const onCreateStub = jest.fn(), onDestroyStub = jest.fn();

    @ModuleClass()
    class TestModule {

      @OnModuleCreate()
      onModuleCreate(@Inject(injectToken) param: any) {
        onCreateStub();
      }

      @OnModuleDestroy()
      async onModuleDestroy() {
        onDestroyStub();
      }
    }

    const moduleInstance = new ModuleInstance(TestModule, container);
    await moduleInstance.onSetup();
    expect(onCreateStub).toHaveBeenCalled();
    await moduleInstance.onDestroy();
    expect(onDestroyStub).toHaveBeenCalled();
  });

  test('Call inherited module lifecycle', async () => {
    // For unknown reason jest.spy does not work here. Use stub pattern instead
    const onCreateStub = jest.fn(), onDestroyStub = jest.fn();

    @ModuleClass()
    class Parent {

      @OnModuleCreate()
      onModuleCreate(@Inject(injectToken) param: any) {
        onCreateStub();
      }

      @OnModuleDestroy()
      async onModuleDestroy() {
      }
    }

    @ModuleClass()
    class Child extends Parent {
      @OnModuleDestroy()
      async onChildModuleDestroy() {
        onDestroyStub();
      }

    }

    const moduleInstance = new ModuleInstance(Child, container);
    await moduleInstance.onSetup();
    expect(onCreateStub).toHaveBeenCalled();
    await moduleInstance.onDestroy();
    expect(onDestroyStub).toHaveBeenCalled();

  });

  test('Component resolve', async () => {
    const name = 'name' + Math.random();
    const key = Symbol();
    const value = Symbol();
    const id = Symbol();

    @Component()
    class UnnamedComponent {}

    @Component({id, name})
    class NamedComponent {}

    @Component({id, tags: [{key, value}]})
    class TaggedComponent {}

    @ModuleClass({
      components: [UnnamedComponent, NamedComponent, TaggedComponent],
    })
    class Dependency {
      constructor(
        @Inject(UnnamedComponent) unnamed: UnnamedComponent,
        @Inject(id) @Named(name) named: NamedComponent,
        @Inject(id) @Tagged(key, value) tagged: TaggedComponent,
      ) {}

      @OnModuleCreate()
      onCreate(
        @Inject(UnnamedComponent) unnamed: UnnamedComponent,
        @Inject(id) @Named(name) named: NamedComponent,
        @Inject(id) @Tagged(key, value) tagged: TaggedComponent,
      ) {
      }

      @OnModuleDestroy()
      onDestroy(
        @Inject(UnnamedComponent) unnamed: UnnamedComponent,
        @Inject(id) @Named(name) named: NamedComponent,
        @Inject(id) @Tagged(key, value) tagged: TaggedComponent,
      ) {
      }
    }

    const instance = new ModuleInstance(Dependency, new Container());
    await instance.onSetup();
    await instance.onDestroy();
  });

  test('Factory resolve', async () => {
    const name = 'name' + Math.random();
    const key = Symbol();
    const value = Symbol();
    const unnamedId = Symbol();
    const namedId = Symbol();
    const taggedId = Symbol();

    @Component()
    class UnnamedComponent extends ComponentFactory<void> {
      build() {}
    }

    @Component()
    class NamedComponent extends ComponentFactory<void> {
      build() {}
    }

    @Component()
    class TaggedComponent extends ComponentFactory<void> {
      build() {}
    }

    @ModuleClass({
      factories: [
        {provide: unnamedId, factory: UnnamedComponent},
        {provide: namedId, factory: NamedComponent},
        {provide: taggedId, factory: TaggedComponent},
      ],
    })
    class Dependency {
      constructor(
        @Inject(unnamedId) unnamed: undefined,
        @Inject(namedId) @Named(name) named: undefined,
        @Inject(taggedId) @Tagged(key, value) tagged: undefined,
      ) {}

      @OnModuleCreate()
      onCreate(
        @Inject(unnamedId) unnamed: undefined,
        @Inject(namedId) @Named(name) named: undefined,
        @Inject(taggedId) @Tagged(key, value) tagged: undefined,
      ) {
      }

      @OnModuleDestroy()
      onDestroy(
        @Inject(unnamedId) unnamed: undefined,
        @Inject(namedId) @Named(name) named: undefined,
        @Inject(taggedId) @Tagged(key, value) tagged: undefined,
      ) {
      }
    }

    const instance = new ModuleInstance(Dependency, new Container());
    await instance.onSetup();
    await instance.onDestroy();
  });

  test('Constants resolve', async () => {

    const name = 'name' + Math.random();
    const key = Symbol();
    const value = Symbol();
    const unnamedId = Symbol();
    const namedId = Symbol();
    const taggedId = Symbol();

    @ModuleClass({
      constants: [
        {provide: unnamedId, value: Symbol()},
        {provide: namedId, value: Symbol()},
        {provide: taggedId, value: Symbol()},
      ],
    })
    class Dependency {
      constructor(
        @Inject(unnamedId) unnamed: symbol,
        @Inject(namedId) @Named(name) named: symbol,
        @Inject(taggedId) @Tagged(key, value) tagged: symbol,
      ) {}

      @OnModuleCreate()
      onCreate(
        @Inject(unnamedId) unnamed: symbol,
        @Inject(namedId) @Named(name) named: symbol,
        @Inject(taggedId) @Tagged(key, value) tagged: symbol,
      ) {
      }

      @OnModuleDestroy()
      onDestroy(
        @Inject(unnamedId) unnamed: symbol,
        @Inject(namedId) @Named(name) named: symbol,
        @Inject(taggedId) @Tagged(key, value) tagged: symbol,
      ) {
      }
    }

    const instance = new ModuleInstance(Dependency, new Container());
    await instance.onSetup();
    await instance.onDestroy();
  });
});

describe('Module Root', () => {

  test('component resolve', async () => {
    const xOnCreateSpy = jest.fn(), xOnDestroySpy = jest.fn();
    const yOnCreateSpy = jest.fn(), yOnDestroySpy = jest.fn();
    const zOnCreateSpy = jest.fn(), zOnDestroySpy = jest.fn();

    @Component()
    class A {}

    @ModuleClass({
      components: [A],
    })
    class X {
      constructor(@Inject(A) unnamed: A) {}

      @OnModuleCreate()
      onCreate(@Inject(A) unnamed: A) {
        expect(zOnCreateSpy).not.toHaveBeenCalled();
        xOnCreateSpy();
      }

      @OnModuleDestroy()
      onDestroy(@Inject(A) unnamed: A) {
        expect(zOnDestroySpy).toHaveBeenCalled();
        xOnDestroySpy();
      }
    }


    @ModuleClass({
      requires: [X],
    })
    class Y {

      @OnModuleCreate()
      onCreate(@Inject(A) unnamed: A) {
        expect(xOnCreateSpy).toHaveBeenCalled();
        expect(zOnCreateSpy).not.toHaveBeenCalled();
        yOnCreateSpy();
      }

      @OnModuleDestroy()
      onDestroy(@Inject(A) unnamed: A) {
        expect(xOnDestroySpy).not.toHaveBeenCalled();
        expect(zOnDestroySpy).toHaveBeenCalled();
        yOnDestroySpy();
      }
    }


    @ModuleClass({
      requires: [X, Y],
    })
    class Z {
      constructor(@Inject(A) unnamed: A) {}

      @OnModuleCreate()
      onCreate(@Inject(A) unnamed: A) {
        expect(xOnCreateSpy).toHaveBeenCalled();
        expect(yOnCreateSpy).toHaveBeenCalled();
        zOnCreateSpy();
      }

      @OnModuleDestroy()
      onDestroy(@Inject(A) unnamed: A) {
        expect(xOnDestroySpy).not.toHaveBeenCalled();
        expect(yOnDestroySpy).not.toHaveBeenCalled();
        zOnDestroySpy();
      }
    }

    const moduleRoot = new ModuleRoot(Z);

    await moduleRoot.start();
    expect(zOnCreateSpy).toHaveBeenCalled();
    await moduleRoot.stop();
    expect(xOnDestroySpy).toHaveBeenCalled();
  });


});
