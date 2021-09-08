import {
  AsyncResolveInterceptor,
  AsyncResolveInterceptorFactory,
  Binding,
  BindingType,
  Class,
  ConstantBinding,
  Constructor,
  FactoryBinding,
  InjectScope,
  InstanceBinding,
  InvokeResult,
  ParamInjectionMetadata,
  ServiceId,
} from './types';
import {BindingNotFoundError, CircularAliasError, CircularDependencyError, DuplicatedBindingError} from './errors';
import {BuildInstruction, Instruction, InstructionCode, PlanInstruction, TransformInstruction} from './instructions';
import {
  convertParamInjectionMetadata,
  ensureConstructorParamInjectMetadata,
  ensureValidatedMethodInvokeProxy,
  ensureValidatedParamInjectMetadata,
  getConstructorParamInjectMetadata,
  getInjectScope,
} from './metadata';

function compileParamInjectInstruction(
  paramInjectionMetadata: ParamInjectionMetadata[],
  allowTemporary: boolean,
): Instruction[] {
  const sortedMetadata = ensureValidatedParamInjectMetadata(paramInjectionMetadata);
  return sortedMetadata.reduceRight((instructions, m): Instruction[] => {
    const {id, transform, optional} = m;
    if (typeof transform === 'function') {
      instructions.push({code: InstructionCode.TRANSFORM, transformer: transform});
    }
    instructions.push({code: InstructionCode.PLAN, target: id, optional, allowTemporary});
    return instructions;
  }, [] as Instruction[]);
}
function constructorToFactory(constructor: Class) {
  return (...params: any[]) => Reflect.construct(constructor, params);
}

export class ResolveSession {
  private readonly planingSet: Set<ServiceId> = new Set();
  private readonly instructions: Instruction[] = [];
  private readonly sessionCache: Map<any, any> = new Map();
  private readonly temporaryBinding: Map<ServiceId, ConstantBinding<any>> = new Map();
  private readonly stack: any[] = [];
  private allFinished: Promise<void>;

  constructor(
    readonly bindingMap: Map<ServiceId, Binding<any>>,
    readonly compiledInstructionMap: Map<ServiceId, Instruction[]>,
    readonly globalCache: Map<any, any>,
  ) {
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
    this.performPlan({code: InstructionCode.PLAN, optional: false, target, allowTemporary: true});
    const self = this.evalInstructions() as T;
    this.performPlan({code: InstructionCode.PLAN, optional: false, target: proxy, allowTemporary: true}, true);
    const proxyInstance = this.evalInstructions() as InstanceType<typeof proxy>;
    return proxyInstance.call(fn, self);
  }

  resolve<T>(target: ServiceId<T>): T {
    this.resetState();
    this.performPlan({code: InstructionCode.PLAN, optional: false, target, allowTemporary: true});
    return this.evalInstructions();
  }
  construct<T>(target: Constructor<T>): T {
    this.resetState();
    this.performPlan({code: InstructionCode.PLAN, optional: false, target, allowTemporary: true}, true);
    return this.evalInstructions();
  }

  private dependentsCleanedUp: (e?: unknown) => void = () => {};

  private resetState() {
    /** Clear stack */
    this.stack.splice(0);
  }

  private evalInstructions() {
    for (;;) {
      const instruction = this.instructions.pop();
      if (!instruction) {
        return this.stack.pop();
      }

      switch (instruction.code) {
        case InstructionCode.PLAN:
          this.performPlan(instruction, false);
          break;
        case InstructionCode.TRANSFORM:
          this.performTransform(instruction);
          break;
        case InstructionCode.BUILD:
          this.performBuild(instruction);
          break;
      }
    }
  }

  /**
   * Get binding and resolve alias
   * @param target
   * @param allowTemporary
   * @private
   */
  private internalGetBinding(target: ServiceId, allowTemporary: boolean) {
    let binding;
    const resolvingSet = new Set();
    for (;;) {
      if (allowTemporary && this.temporaryBinding.has(target)) {
        return this.temporaryBinding.get(target);
      }
      binding = this.bindingMap.get(target);
      if (!binding) {
        return;
      }
      if (binding.type !== BindingType.ALIAS) {
        return binding;
      }
      target = binding.canonicalId;
      if (resolvingSet.has(target)) {
        throw new CircularAliasError(target);
      }
      resolvingSet.add(target);
    }
  }

  private resolveFromCache(target: ServiceId) {
    if (this.globalCache.has(target)) {
      this.stack.push(this.globalCache.get(target));
      return true;
    } else if (this.sessionCache.has(target)) {
      this.stack.push(this.sessionCache.get(target));
      return true;
    }
    return false;
  }

  private getBindingForPlan(
    target: ServiceId,
    optionalInject: boolean,
    allowUnbound: boolean,
    allowTemporary: boolean,
  ) {
    const binding = this.internalGetBinding(target, allowTemporary);
    if (binding) {
      return binding;
    }
    if (optionalInject) {
      this.stack.push(undefined);
      return;
    } else if (allowUnbound && typeof target === 'function') {
      const cm = convertParamInjectionMetadata(ensureConstructorParamInjectMetadata(target));
      this.instructions.push(
        {
          code: InstructionCode.BUILD,
          cacheScope: InjectScope.TRANSIENT,
          factory: constructorToFactory(target),
          paramCount: cm.length,
          serviceId: target,
        },
        ...compileParamInjectInstruction(cm, true),
      );
      return;
    }
    throw new BindingNotFoundError(target);
  }

  private performPlan(instruction: PlanInstruction, allowUnbound = false) {
    const {target, optional, allowTemporary} = instruction;
    if (this.planingSet.has(target)) {
      throw new CircularDependencyError(target);
    }
    /**
     * Interceptor may directly put something into session cache, we need to
     * check the cache first, otherwise a BindingNotFoundError may be thrown
     */
    if (this.resolveFromCache(target)) {
      return;
    }
    const binding = this.getBindingForPlan(target, optional, allowUnbound, allowTemporary);
    if (!binding) {
      return;
    }
    if (this.resolveFromCache(binding.id)) {
      return;
    }
    const disableTemporary = binding.type !== BindingType.CONSTANT && binding.scope === InjectScope.SINGLETON;
    switch (binding.type) {
      case BindingType.CONSTANT:
        this.stack.push(binding.value);
        break;
      case BindingType.INSTANCE:
      case BindingType.FACTORY:
      case BindingType.ASYNC_FACTORY:
        {
          this.planingSet.add(binding.id);
          const instructions = this.compiledInstructionMap.get(binding.id);
          if (!instructions) {
            throw new Error('BUG: No compiled instruction found');
          }
          this.instructions.push(...instructions);
        }
        break;
    }
  }

  private performTransform(instruction: TransformInstruction) {
    const {transformer} = instruction;
    const top = this.stack.pop();
    this.stack.push(transformer(top));
  }

  private performBuild(instruction: BuildInstruction) {
    const {paramCount, factory, cacheScope, serviceId} = instruction;
    this.checkCache(cacheScope, serviceId);
    const args = this.stack.splice(this.stack.length - paramCount);
    const result = factory(...args);
    this.cacheIfNecessary(cacheScope, serviceId, result);
    this.stack.push(result);
    this.planingSet.delete(serviceId);
  }

  private cacheIfNecessary(cacheScope: InjectScope, serviceId: Class<any> | string | symbol, result: any) {
    if (cacheScope === InjectScope.REQUEST || cacheScope === InjectScope.SESSION) {
      this.sessionCache.set(serviceId, result);
    } else if (cacheScope === InjectScope.SINGLETON) {
      this.globalCache.set(serviceId, result);
    }
  }

  private checkCache(cacheScope: InjectScope, serviceId: ServiceId) {
    if (cacheScope === InjectScope.SINGLETON) {
      if (this.globalCache.has(serviceId)) {
        throw new Error('BUG: Reconstruct a global singleton');
      }
    }

    if (cacheScope === InjectScope.REQUEST || cacheScope === InjectScope.SESSION) {
      if (this.sessionCache.has(serviceId)) {
        throw new Error('BUG: Reconstruct an injectable that already exists in session cache');
      }
    }
  }

  public addTemporaryConstantBinding<T>(serviceId: ServiceId<T>, value: T): this {
    this.temporaryBinding.set(serviceId, {
      type: BindingType.CONSTANT,
      id: serviceId,
      value,
    });
    return this;
  }
}

/**
 * @deprecated
 */
export class ResolveContext extends ResolveSession {}

export class Container {
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

  private internalValidateDependencies(binding: Binding<unknown>, visitPath: ServiceId[], set: Set<ServiceId>) {
    if (set.has(binding.id)) {
      return;
    }
    set.add(binding.id);
    switch (binding.type) {
      case BindingType.CONSTANT:
        return;
      // visitPath.forEach((x)=> )
      case BindingType.ASYNC_FACTORY:
      case BindingType.FACTORY:
      case BindingType.INSTANCE:
        {
          for (const m of binding.paramInjectionMetadata) {
            if (visitPath.indexOf(m.id) >= 0) {
              throw new Error('Circular dependencies');
            }

            const binding = this.bindingMap.get(m.id);
            if (typeof binding === 'undefined') {
              if (!m.optional) {
                // TODO:
                throw new Error('Unmet dependencies: ' + m.id.toString());
              }
              return;
            }
            this.internalValidateDependencies(binding, [...visitPath, m.id], set);
          }
        }
        break;
      case BindingType.ALIAS: {
        if (visitPath.indexOf(binding.canonicalId) >= 0) {
          throw new Error('Circular dependencies');
        }
        this.bindingMap.has(binding.canonicalId);
        if (this.bindingMap.has(binding.canonicalId)) {
          throw new Error('Unmet dependencies: ' + binding.canonicalId.toString());
        }
        this.internalValidateDependencies(binding, [...visitPath, binding.canonicalId], set);
      }
    }
  }

  /**
   * Validate all dependencies between components are met and there is no circular
   */
  validate() {
    const set = new Set<ServiceId>();
    this.bindingMap.forEach((binding) => this.internalValidateDependencies(binding, [], set));
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

    if (binding.type === BindingType.INSTANCE) {
      this.compileInstanceBinding(binding);
    } else if (binding.type === BindingType.FACTORY) {
      this.compileFactoryBinding(binding);
    }
    return this;
  }

  resolve<T>(serviceId: ServiceId<T>): T {
    return this.createResolveSession().resolve(serviceId);
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
