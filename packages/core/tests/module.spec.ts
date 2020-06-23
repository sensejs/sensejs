import {Container} from 'inversify';
import {
  Component,
  ComponentFactory,
  createModule,
  getModuleMetadata,
  Inject,
  ModuleClass,
  ModuleOption,
  ModuleRoot,
  Named,
  OnModuleCreate,
  OnModuleDestroy,
  ServiceIdentifier,
  Tagged,
} from '../src';
import {ModuleInstance} from '../src/module-instance';

describe('@ModuleClass', () => {

  test('created module metadata', () => {
    const dependency = createModule();
    expect(getModuleMetadata(createModule({requires: [dependency]}))).toEqual(expect.objectContaining({
      requires: [dependency],
      onModuleCreate: [],
      onModuleDestroy: [],
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
      onModuleDestroy: [X.prototype.bar, X.prototype.onModuleDestroy],
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

});

describe('Module resolve', () => {

  const name = 'name' + Math.random();
  const key = Symbol();
  const value = Symbol();
  const id = Symbol();

  const unnamedId = Symbol();
  const namedId = Symbol();
  const taggedId = Symbol();

  function createStubModule(
    option: ModuleOption,
    unnamedTarget: ServiceIdentifier = unnamedId,
    namedTarget: ServiceIdentifier = namedId,
    taggedTarget: ServiceIdentifier = taggedId,
  ) {
    @ModuleClass(option)
    class StubModule {
      constructor(
        @Inject(unnamedTarget) unnamed: unknown,
        @Inject(namedTarget) @Named(name) named: unknown,
        @Inject(taggedTarget) @Tagged(key, value) tagged: unknown,
      ) {}

      @OnModuleCreate()
      onCreate(
        @Inject(unnamedTarget) unnamed: unknown,
        @Inject(namedTarget) @Named(name) named: unknown,
        @Inject(taggedTarget) @Tagged(key, value) tagged: unknown,
      ) {
      }

      @OnModuleDestroy()
      onDestroy(
        @Inject(unnamedTarget) unnamed: unknown,
        @Inject(namedTarget) @Named(name) named: unknown,
        @Inject(taggedTarget) @Tagged(key, value) tagged: unknown,
      ) {
      }
    }

    return StubModule;
  }

  test('Component resolve', async () => {

    @Component({id: unnamedId})
    class UnnamedComponent {}

    @Component({id: namedId, name})
    class NamedComponent {}

    @Component({id: taggedId, tags: [{key, value}]})
    class TaggedComponent {}

    abstract class GrantParent {
      bar() {return 'bar';}
    }

    abstract class Parent extends GrantParent {
      foo() {return 'foo';}
    }

    @Component()
    class Child extends Parent {

    }

    @ModuleClass({
      components: [Child]
    })
    class MyModule {
      @OnModuleCreate()
      onCreate(
        @Inject(Parent) parent: Parent,
        @Inject(GrantParent) grantParent: GrantParent,
        @Inject(Child) child: Child,
      ) {
        expect(child).toStrictEqual(parent);
        expect(parent).toStrictEqual(grantParent);
        expect(child.foo()).toEqual('foo');
        expect(child.bar()).toEqual('bar');
      }
    }

    const instance = new ModuleRoot(createStubModule({
      requires: [MyModule],
      components: [UnnamedComponent, NamedComponent, TaggedComponent],
    }, UnnamedComponent, NamedComponent, TaggedComponent));
    await instance.start();
    await instance.stop();
  });

  test('Factory resolve', async () => {
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

    const instance = new ModuleInstance(createStubModule({
      factories: [
        {provide: unnamedId, factory: UnnamedComponent},
        {provide: namedId, factory: NamedComponent},
        {provide: taggedId, factory: TaggedComponent},
      ],
    }), new Container());
    await instance.onSetup();
    await instance.onDestroy();
  });

  test('Constants resolve', async () => {

    const instance = new ModuleInstance(createStubModule({
      constants: [
        {provide: unnamedId, value: Symbol()},
        {provide: namedId, value: Symbol()},
        {provide: taggedId, value: Symbol()},
      ],
    }), new Container());
    await instance.onSetup();
    await instance.onDestroy();
  });
});

describe('Module Root', () => {

  test('lifecycle', async () => {
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
