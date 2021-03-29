import {
  AsyncResolveInterceptor,
  AsyncResolveInterceptorFactory,
  Binding,
  BindingType,
  Class,
  Constructor,
  FactoryBinding,
  InstanceBinding,
  ParamInjectionMetadata,
  Scope,
  ServiceId,
} from './types';
import {BindingNotFoundError, CircularAliasError, CircularDependencyError, DuplicatedBindingError} from './errors';
import {BuildInstruction, Instruction, InstructionCode, PlanInstruction, TransformInstruction} from './instructions';
import {
  convertParamInjectionMetadata,
  ensureConstructorParamInjectMetadata,
  ensureValidatedMethodInvokeProxy,
  ensureValidatedParamInjectMetadata,
} from './metadata';

export type InvokeResult<T extends {}, K extends keyof T> = T[K] extends (...args: any[]) => Promise<infer R>
  ? R
  : T[K] extends (...args: any[]) => infer R
  ? R
  : never;

function compileParamInjectInstruction(paramInjectionMetadata: ParamInjectionMetadata[]): Instruction[] {
  const sortedMetadata = ensureValidatedParamInjectMetadata(paramInjectionMetadata);
  return sortedMetadata.reduceRight((instructions, m): Instruction[] => {
    const {id, transform, optional} = m;
    if (typeof transform === 'function') {
      instructions.push({code: InstructionCode.TRANSFORM, transformer: transform});
    }
    instructions.push({code: InstructionCode.PLAN, target: id, optional});
    return instructions;
  }, [] as Instruction[]);
}
function constructorToFactory(constructor: Class) {
  return (...params: any[]) => Reflect.construct(constructor, params);
}

export class ResolveContext {
  private readonly planingSet: Set<ServiceId> = new Set();
  private readonly instructions: Instruction[] = [];
  private readonly requestSingletonCache: Map<any, any> = new Map();
  private readonly stack: any[] = [];
  private allFinished: Promise<void>;
  private allowUnbound = false;

  constructor(
    readonly bindingMap: Map<ServiceId, Binding<any>>,
    readonly compiledInstructionMap: Map<ServiceId, Instruction[]>,
    readonly globalSingletonCache: Map<any, any>,
  ) {
    this.allFinished = new Promise<void>((resolve, reject) => {
      this.dependentsCleanedUp = (e?: Error) => {
        if (e) {
          return reject(e);
        }
        return resolve();
      };
    });
  }

  async intercept(interceptor: AsyncResolveInterceptorFactory): Promise<void> {
    const {interceptorBuilder, paramInjectionMetadata} = interceptor;
    const serviceId = Symbol();
    this.instructions.push(
      {
        code: InstructionCode.BUILD,
        cacheScope: Scope.TRANSIENT,
        factory: interceptorBuilder,
        paramCount: paramInjectionMetadata.length,
        serviceId,
      },
      ...compileParamInjectInstruction(paramInjectionMetadata),
    );
    const interceptorInstance = this.evalInstructions() as AsyncResolveInterceptor;
    const cleanUp = this.dependentsCleanedUp;
    const successorsFinished = new Promise<void>((resolve, reject) => {
      this.dependentsCleanedUp = (e?: Error) => {
        if (e) {
          return reject(e);
        }
        return resolve();
      };
    }).then(
      () => cleanUp(),
      (e) => cleanUp(e),
    );
    return new Promise<void>((resolve, reject) => {
      const allFinished = this.allFinished;
      this.allFinished = interceptorInstance(async () => {
        resolve();
        return successorsFinished;
      });
      this.allFinished.catch(reject);
      this.allFinished.finally(() => allFinished);
    });
  }

  async cleanUp(): Promise<void> {
    if (this.dependentsCleanedUp) {
      this.dependentsCleanedUp();
    }
    return this.allFinished;
  }

  setAllowUnbound(value: boolean): this {
    this.allowUnbound = value;
    return this;
  }

  invoke<T extends {}, K extends keyof T>(target: Constructor<T>, key: K): InvokeResult<T, K> {
    this.performPlan({code: InstructionCode.PLAN, optional: false, target});
    const self = this.evalInstructions() as T;
    const fn = self[key];
    if (typeof fn !== 'function') {
      throw new TypeError(`${target.name}.${String(key)} is not a function`);
    }
    const proxy = ensureValidatedMethodInvokeProxy(target.prototype, key);
    this.performPlan({code: InstructionCode.PLAN, optional: false, target: proxy});
    const proxyInstance = this.evalInstructions() as InstanceType<typeof proxy>;
    return proxyInstance.call(fn, self);
  }

  resolve<T>(target: ServiceId<T>): T {
    this.performPlan({code: InstructionCode.PLAN, optional: false, target});
    return this.evalInstructions();
  }

  private dependentsCleanedUp: (e?: Error) => void = () => {};

  private evalInstructions() {
    for (;;) {
      const instruction = this.instructions.pop();
      if (!instruction) {
        return this.stack.pop();
      }

      switch (instruction.code) {
        case InstructionCode.PLAN:
          this.performPlan(instruction);
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
   * @private
   */
  private internalGetBinding(target: ServiceId) {
    let binding;
    const resolvingSet = new Set();
    for (;;) {
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
    if (this.globalSingletonCache.has(target)) {
      this.stack.push(this.globalSingletonCache.get(target));
      return true;
    } else if (this.requestSingletonCache.has(target)) {
      this.stack.push(this.requestSingletonCache.get(target));
      return true;
    }
    return false;
  }

  private getBindingForPlan(target: ServiceId, optionalInject: boolean) {
    const binding = this.internalGetBinding(target);
    if (binding) {
      return binding;
    }
    if (optionalInject) {
      this.stack.push(undefined);
      return;
    } else if (this.allowUnbound && typeof target === 'function') {
      const cm = convertParamInjectionMetadata(ensureConstructorParamInjectMetadata(target));
      this.instructions.push(
        {
          code: InstructionCode.BUILD,
          cacheScope: Scope.TRANSIENT,
          factory: constructorToFactory(target),
          paramCount: cm.length,
          serviceId: target,
        },
        ...compileParamInjectInstruction(cm),
      );
      return;
    }
    throw new BindingNotFoundError(target);
  }

  private performPlan(instruction: PlanInstruction) {
    const {target, optional} = instruction;
    if (this.planingSet.has(target)) {
      throw new CircularDependencyError(target);
    }
    /**
     * Interceptor may directly put something into request cache, we need to
     * check the cache first, otherwise a BindingNotFoundError may be thrown
     */
    if (this.resolveFromCache(target)) {
      return;
    }
    const binding = this.getBindingForPlan(target, optional);
    if (!binding) {
      return;
    }
    if (this.resolveFromCache(binding.id)) {
      return;
    }
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

  private cacheIfNecessary(
    cacheScope: Scope | Scope.SINGLETON | Scope.TRANSIENT,
    serviceId: Class<any> | string | symbol,
    result: any,
  ) {
    if (cacheScope === Scope.REQUEST) {
      this.requestSingletonCache.set(serviceId, result);
    } else if (cacheScope === Scope.SINGLETON) {
      this.globalSingletonCache.set(serviceId, result);
    }
  }

  private checkCache(cacheScope: Scope, serviceId: ServiceId) {
    if (cacheScope === Scope.SINGLETON) {
      if (this.globalSingletonCache.has(serviceId)) {
        throw new Error('BUG: Reconstruct a global singleton');
      }
    }

    if (cacheScope === Scope.REQUEST) {
      if (this.requestSingletonCache.has(serviceId)) {
        throw new Error('BUG: Reconstruct a request-scope singleton');
      }
    }
  }

  public addTemporaryConstantBinding<T>(serviceId: ServiceId<T>, value: T): this {
    this.requestSingletonCache.set(serviceId, value);
    return this;
  }
}

export class Container {
  private bindingMap: Map<ServiceId, Binding<any>> = new Map();
  private compiledInstructionMap: Map<ServiceId, Instruction[]> = new Map();
  private singletonCache: Map<ServiceId, any> = new Map();

  createResolveContext(): ResolveContext {
    return new ResolveContext(this.bindingMap, this.compiledInstructionMap, this.singletonCache);
  }

  add(ctor: Constructor): this {
    const cm = ensureConstructorParamInjectMetadata(ctor);
    this.addBinding({
      type: BindingType.INSTANCE,
      id: ctor,
      constructor: ctor,
      scope: cm.scope,
      paramInjectionMetadata: convertParamInjectionMetadata(cm),
    });
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
    return this.createResolveContext().resolve(serviceId);
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
      ...compileParamInjectInstruction(paramInjectionMetadata),
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
      ...compileParamInjectInstruction(paramInjectionMetadata),
    ]);
  }
}
