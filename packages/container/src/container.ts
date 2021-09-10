import {
  AsyncInterceptProvider,
  AsyncResolveInterceptor,
  AsyncResolveInterceptorFactory,
  Binding,
  BindingType,
  Constructor,
  FactoryBinding,
  InjectScope,
  InstanceBinding,
  InvokeResult,
  ParamInjectionMetadata,
  ServiceId,
} from './types';
import {DuplicatedBindingError} from './errors';
import {Instruction, InstructionCode} from './instructions';
import {
  convertParamInjectionMetadata,
  ensureConstructorParamInjectMetadata,
  ensureValidatedMethodInvokeProxy,
  getConstructorParamInjectMetadata,
  getInjectScope,
} from './metadata';
import {MethodInvoker} from './method-invoker';
import {Resolver} from './resolver';
import {compileParamInjectInstruction, internalValidateDependencies} from './utils';

export class ResolveSession extends Resolver {
  private allFinished: Promise<void>;

  constructor(
    bindingMap: Map<ServiceId, Binding<any>>,
    compiledInstructionMap: Map<ServiceId, Instruction[]>,
    globalCache: Map<any, any>,
  ) {
    super(bindingMap, compiledInstructionMap, globalCache);
    this.allFinished = new Promise<void>((resolve, reject) => {
      this.dependentsCleanedUp = (e?: unknown) => {
        if (e) {
          return reject(e);
        }
        return resolve();
      };
    });
  }

  async intercept(interceptor: AsyncResolveInterceptorFactory): Promise<void> {
    this.resetState();
    const {interceptorBuilder, paramInjectionMetadata} = interceptor;
    const serviceId = Symbol();
    this.instructions.push(
      {
        code: InstructionCode.BUILD,
        cacheScope: InjectScope.TRANSIENT,
        factory: interceptorBuilder,
        paramCount: paramInjectionMetadata.length,
        serviceId,
      },
      ...compileParamInjectInstruction(paramInjectionMetadata, true),
    );
    const interceptorInstance = this.evalInstructions() as AsyncResolveInterceptor;
    return new Promise<void>((resolve, reject) => {
      const cleanUp = this.dependentsCleanedUp;
      let errorHandler = reject;
      const previousFinished = this.allFinished;
      this.allFinished = interceptorInstance(async () => {
        errorHandler = cleanUp;
        resolve();
        return new Promise<void>((resolve, reject) => {
          this.dependentsCleanedUp = (e?: unknown) => {
            if (e) {
              return reject(e);
            }
            return resolve();
          };
        });
      })
        .then(
          () => cleanUp(),
          (e) => {
            errorHandler(e);
          },
        )
        .finally(() => previousFinished);
    });
  }

  async cleanUp(e?: unknown): Promise<void> {
    if (this.dependentsCleanedUp) {
      this.dependentsCleanedUp(e);
    }
    return this.allFinished;
  }

  invoke<T extends {}, K extends keyof T>(target: Constructor<T>, key: K): InvokeResult<T, K> {
    this.resetState();
    const [proxy, fn] = ensureValidatedMethodInvokeProxy(target, key);
    const self = this.resolve(target) as T;
    const proxyInstance = this.construct(proxy);
    return proxyInstance.call(fn, self);
  }

  private dependentsCleanedUp: (e?: unknown) => void = () => {};
}

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

  createMethodInvoker<T extends {}, K extends keyof T, Context>(
    targetConstructor: Constructor<T>,
    targetMethod: K,
    contextFactory: {
      factory: (...args: any[]) => Context;
      paramInjectionMetadata: ParamInjectionMetadata[];
    },
    asyncInterceptProviders: Constructor<AsyncInterceptProvider<Context, any>>[],
  ): MethodInvoker<any, T, K> {
    return new MethodInvoker(
      this.bindingMap,
      this.compiledInstructionMap,
      this.singletonCache,
      targetConstructor,
      targetMethod,
      contextFactory,
      asyncInterceptProviders,
    );
  }

  /**
   * Validate all dependencies between components are met and there is no circular
   */
  validate() {
    new Resolver(this.bindingMap, this.compiledInstructionMap, this.singletonCache).validate();
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
