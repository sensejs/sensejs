import {
  AsyncInterceptProvider,
  Binding,
  BindingType,
  Constructor,
  FactoryBinding,
  InjectScope,
  InstanceBinding,
  ServiceId,
} from './types';
import {DuplicatedBindingError} from './errors';
import {Instruction, InstructionCode} from './instructions';
import {
  convertParamInjectionMetadata,
  ensureConstructorParamInjectMetadata,
  getConstructorParamInjectMetadata,
  getInjectScope,
} from './metadata';
import {MethodInvoker} from './method-invoker';
import {ResolveSession} from './resolve-session';
import {compileParamInjectInstruction, internalValidateDependencies} from './utils';

/**
 * @deprecated
 */
export class ResolveContext extends ResolveSession {}

export class Container {
  private pendingBindingMap: Map<ServiceId, Binding<any>> = new Map();
  private bindingMap: Map<ServiceId, Binding<any>> = new Map();
  private compiledInstructionMap: Map<ServiceId, Instruction[]> = new Map();
  private singletonCache: Map<ServiceId, any> = new Map();

  /** @deprecated */
  createResolveContext(): ResolveContext {
    return new ResolveContext(this.bindingMap, this.compiledInstructionMap, this.singletonCache);
  }

  createResolveSession(): ResolveSession {
    return new ResolveSession(this.bindingMap, this.compiledInstructionMap, this.singletonCache);
  }

  createMethodInvoker<T extends {}, K extends keyof T>(
    targetConstructor: Constructor<T>,
    targetMethod: K,
    asyncInterceptProviders: Constructor<AsyncInterceptProvider<any>>[],
  ): MethodInvoker<T, K>;
  createMethodInvoker<Context, T extends {}, K extends keyof T>(
    targetConstructor: Constructor<T>,
    targetMethod: K,
    asyncInterceptProviders: Constructor<AsyncInterceptProvider<any>>[],
    contextId?: ServiceId<Context>,
  ): MethodInvoker<T, K, Context>;
  createMethodInvoker<Context, T extends {}, K extends keyof T>(
    targetConstructor: Constructor<T>,
    targetMethod: K,
    asyncInterceptProviders: Constructor<AsyncInterceptProvider<any>>[],
    contextId?: ServiceId<Context>,
  ): MethodInvoker<T, K, Context> {
    this.compile();
    return new MethodInvoker(
      this.bindingMap,
      this.compiledInstructionMap,
      this.singletonCache,
      targetConstructor,
      targetMethod,
      asyncInterceptProviders,
      contextId,
    );
  }

  /**
   * Validate all dependencies between components are met and there is no circular
   */
  validate() {
    new ResolveSession(this.bindingMap, this.compiledInstructionMap, this.singletonCache).validate();
  }

  add(ctor: Constructor): this {
    const cm = ensureConstructorParamInjectMetadata(ctor);
    const scope = getInjectScope(ctor) ?? InjectScope.SESSION;
    this.addBinding({
      type: BindingType.INSTANCE,
      id: ctor,
      constructor: ctor,
      scope,
      paramInjectionMetadata: convertParamInjectionMetadata(cm),
    });
    let parent = Object.getPrototypeOf(ctor);
    while (parent) {
      const metadata = getConstructorParamInjectMetadata(parent);
      if (metadata) {
        this.addBinding({
          type: BindingType.ALIAS,
          id: parent,
          canonicalId: ctor,
        });
      }
      parent = Object.getPrototypeOf(parent);
    }
    return this;
  }

  addBinding<T>(binding: Binding<T>): this {
    const id = binding.id;
    if (this.bindingMap.has(id) || this.pendingBindingMap.has(id)) {
      throw new DuplicatedBindingError(id);
    }
    this.pendingBindingMap.set(id, binding);
    return this;
  }

  resolve<T>(serviceId: ServiceId<T>): T {
    return this.createResolveSession().resolve(serviceId);
  }

  compile() {
    const validatedSet = new Set(this.bindingMap.keys());
    const mergedBindingMap = new Map([...this.bindingMap.entries()]);
    this.pendingBindingMap.forEach((value, key) => mergedBindingMap.set(key, value));

    for (const [, binding] of this.pendingBindingMap) {
      internalValidateDependencies(binding, mergedBindingMap, [], validatedSet);
    }

    // Pending bindings are now validated, merge and compile them

    this.pendingBindingMap.forEach((value, key) => {
      this.bindingMap.set(key, value);
      switch (value.type) {
        case BindingType.FACTORY:
          this.compileFactoryBinding(value);
          break;
        case BindingType.INSTANCE:
          this.compileInstanceBinding(value);
          break;
      }
    });
    this.pendingBindingMap.clear();
    return this;
  }

  private compileFactoryBinding<T>(binding: FactoryBinding<T>) {
    const {scope, paramInjectionMetadata, factory, id} = binding;
    this.compiledInstructionMap.set(id, [
      {
        cacheScope: scope,
        code: InstructionCode.BUILD,
        factory,
        paramCount: paramInjectionMetadata.length,
        serviceId: id,
      },
      ...compileParamInjectInstruction(paramInjectionMetadata, scope !== InjectScope.SINGLETON),
    ]);
  }

  private compileInstanceBinding<T>(binding: InstanceBinding<T>) {
    const {scope, paramInjectionMetadata, constructor, id} = binding;
    this.compiledInstructionMap.set(id, [
      {
        cacheScope: scope,
        code: InstructionCode.BUILD,
        factory: (...params: any[]) => Reflect.construct(constructor, params),
        paramCount: paramInjectionMetadata.length,
        serviceId: id,
      },
      ...compileParamInjectInstruction(paramInjectionMetadata, scope !== InjectScope.SINGLETON),
    ]);
  }
}
