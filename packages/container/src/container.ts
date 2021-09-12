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
  private validatedBindings: Set<ServiceId> = new Set();
  private bindingMap: Map<ServiceId, Binding<any>> = new Map();
  private compiledInstructionMap: Map<ServiceId, Instruction[]> = new Map();
  private singletonCache: Map<ServiceId, any> = new Map();

  /** @deprecated */
  createResolveContext(): ResolveContext {
    return new ResolveContext(
      this.bindingMap,
      this.compiledInstructionMap,
      this.singletonCache,
      this.validatedBindings,
    );
  }

  createResolveSession(): ResolveSession {
    return new ResolveSession(
      this.bindingMap,
      this.compiledInstructionMap,
      this.singletonCache,
      this.validatedBindings,
    );
  }

  createMethodInvoker<T extends {}, K extends keyof T, ServiceIds extends any[] = []>(
    targetConstructor: Constructor<T>,
    targetMethod: K,
    asyncInterceptProviders: Constructor<AsyncInterceptProvider<any>>[],
    ...contextIds: ServiceIds
  ): MethodInvoker<T, K, ServiceIds> {
    this.validate();
    return new MethodInvoker(
      this.bindingMap,
      this.compiledInstructionMap,
      this.singletonCache,
      this.validatedBindings,
      targetConstructor,
      targetMethod,
      asyncInterceptProviders,
      ...contextIds,
    );
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
    if (this.bindingMap.has(id)) {
      throw new DuplicatedBindingError(id);
    }
    this.bindingMap.set(id, binding);
    switch (binding.type) {
      case BindingType.FACTORY:
        this.compileFactoryBinding(binding);
        break;
      case BindingType.INSTANCE:
        this.compileInstanceBinding(binding);
        break;
    }

    return this;
  }

  resolve<T>(serviceId: ServiceId<T>): T {
    return this.createResolveSession().resolve(serviceId);
  }

  validate() {
    for (const [id] of this.bindingMap) {
      if (this.validatedBindings.has(id)) {
        continue;
      }
      internalValidateDependencies(id, this.bindingMap, [], this.validatedBindings);
    }
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
