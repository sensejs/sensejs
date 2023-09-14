import {Binding, BindingType, Constructor, FactoryBinding, InjectScope, InstanceBinding, ServiceId} from './types.js';
import {DuplicatedBindingError} from './errors.js';
import {Instruction, InstructionCode} from './instructions.js';
import {
  convertParamInjectionMetadata,
  ensureConstructorParamInjectMetadata,
  getConstructorParamInjectMetadata,
  getInjectScope,
} from './metadata.js';
import {MethodInvoker} from './method-invoker.js';
import {ResolveSession} from './resolve-session.js';
import {Middleware} from './middleware.js';
import {compileParamInjectInstruction, internalValidateDependencies} from './utils.js';

export class Container {
  #validatedBindings: Set<ServiceId> = new Set();
  #bindingMap: Map<ServiceId, Binding<any>> = new Map();
  #compiledInstructionMap: Map<ServiceId, Instruction[]> = new Map();
  #singletonCache: Map<ServiceId, any> = new Map();

  createResolveSession(): ResolveSession {
    this.validate();
    return new ResolveSession(this.#bindingMap, this.#compiledInstructionMap, this.#singletonCache);
  }

  createMethodInvoker<T extends {}, K extends keyof T, ServiceIds extends any[] = []>(
    targetConstructor: Constructor<T>,
    targetMethod: K,
    middlewares: Constructor<Middleware<any[]>>[],
    ...contextIds: ServiceIds
  ): MethodInvoker<T, K, ServiceIds> {
    this.validate();
    return new MethodInvoker(
      this.#bindingMap,
      this.#compiledInstructionMap,
      this.#singletonCache,
      targetConstructor,
      targetMethod,
      middlewares,
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
    if (this.#bindingMap.has(id)) {
      throw new DuplicatedBindingError(id);
    }
    this.#bindingMap.set(id, binding);
    switch (binding.type) {
      case BindingType.FACTORY:
        this.#compileFactoryBinding(binding);
        break;
      case BindingType.INSTANCE:
        this.#compileInstanceBinding(binding);
        break;
    }

    return this;
  }

  resolve<T>(serviceId: ServiceId<T>): T {
    return this.createResolveSession().resolve(serviceId);
  }

  validate(): this {
    if (this.#validatedBindings.size === this.#bindingMap.size) {
      return this;
    }

    for (const [id] of this.#bindingMap) {
      internalValidateDependencies(id, this.#bindingMap, [], this.#validatedBindings);
    }
    return this;
  }

  #compileFactoryBinding<T>(binding: FactoryBinding<T>) {
    const {scope, paramInjectionMetadata, factory, id} = binding;
    this.#compiledInstructionMap.set(id, [
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

  #compileInstanceBinding<T extends {}>(binding: InstanceBinding<T>) {
    const {scope, paramInjectionMetadata, constructor, id} = binding;
    this.#compiledInstructionMap.set(id, [
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
