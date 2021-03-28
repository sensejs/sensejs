import {
  AsyncFactoryBinding,
  AsyncResolveOption,
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
import {DecoratorMetadata, ensureConstructorParamInjectMetadata} from './decorator';
import {
  AsyncUnsupportedError,
  BindingNotFoundError,
  CircularAliasError,
  CircularDependencyError,
  DuplicatedBindingError,
  InvalidParamBindingError,
} from './errors';
import {
  AsyncBuildInstruction,
  AsyncInterceptInstruction,
  BuildInstruction,
  ConstructInstruction,
  Instruction,
  InstructionCode,
  PlanInstruction,
  TransformInstruction,
} from './instructions';

function convertParamInjectionMetadata(cm: DecoratorMetadata) {
  return Array.from(cm.params.entries()).map(
    ([index, value]): ParamInjectionMetadata => {
      const {id, transform, optional = false} = value;
      if (typeof id === 'undefined') {
        throw new TypeError('param inject id is undefined');
      }
      return {index, id, transform, optional};
    },
  );
}

function compileParamInjectInstruction(paramInjectionMetadata: ParamInjectionMetadata[]): Instruction[] {
  const sortedMetadata = Array.from(paramInjectionMetadata).sort((l, r) => l.index - r.index);
  sortedMetadata.forEach((value, index) => {
    if (value.index !== index) {
      throw new InvalidParamBindingError(sortedMetadata, index);
    }
  });
  return sortedMetadata.reduceRight((instructions, m): Instruction[] => {
    const {id, transform, optional} = m;
    if (typeof transform === 'function') {
      instructions.push({code: InstructionCode.TRANSFORM, transformer: transform});
    }
    instructions.push({code: InstructionCode.PLAN, target: id, optional});
    return instructions;
  }, [] as Instruction[]);
}

export class ResolveContext {
  private readonly planingSet: Set<ServiceId> = new Set();
  private readonly instructions: Instruction[] = [];
  private readonly requestSingletonCache: Map<any, any> = new Map();
  private readonly stack: any[] = [];
  private dependentsCleanedUp?: () => void;
  private allResolved = Promise.resolve();
  private allowUnbound = false;

  constructor(
    readonly bindingMap: Map<ServiceId, Binding<any>>,
    readonly compiledInstructionMap: Map<ServiceId, Instruction[]>,
    readonly globalSingletonCache: Map<any, any>,
  ) {}

  async cleanUp(): Promise<void> {
    if (this.dependentsCleanedUp) {
      this.dependentsCleanedUp();
      this.dependentsCleanedUp = undefined;
    }
    return this.allResolved;
  }

  setAllowUnbound(value: boolean): this {
    this.allowUnbound = value;
    return this;
  }

  async resolveAsync<T>(target: ServiceId<T>, option: AsyncResolveOption = {}): Promise<T> {
    const {interceptors = []} = option;
    this.performPlan({code: InstructionCode.PLAN, optional: false, target});
    interceptors.reduceRight((output, i) => {
      const {interceptorBuilder, paramInjectionMetadata} = i;
      this.instructions.push(
        {
          code: InstructionCode.ASYNC_INTERCEPT,
          interceptorBuilder: interceptorBuilder,
          paramCount: paramInjectionMetadata.length,
        },
        ...compileParamInjectInstruction(i.paramInjectionMetadata),
      );
      return output;
    }, null);

    for (;;) {
      const instruction = this.instructions.pop();
      if (!instruction) {
        return this.stack[0];
      }

      switch (instruction.code) {
        case InstructionCode.CONSTRUCT:
          this.performConstruction(instruction);
          break;
        case InstructionCode.PLAN:
          this.performPlan(instruction);
          break;
        case InstructionCode.TRANSFORM:
          this.performTransform(instruction);
          break;
        case InstructionCode.BUILD:
          this.performBuild(instruction);
          break;
        case InstructionCode.ASYNC_BUILD:
          await this.performAsyncBuild(instruction);
          break;
        case InstructionCode.ASYNC_INTERCEPT:
          await this.performIntercept(instruction);
          break;
      }
    }
  }

  resolve<T>(target: ServiceId<T>): T {
    this.performPlan({code: InstructionCode.PLAN, optional: false, target});
    for (;;) {
      const instruction = this.instructions.pop();
      if (!instruction) {
        return this.stack[0];
      }

      switch (instruction.code) {
        case InstructionCode.CONSTRUCT:
          this.performConstruction(instruction);
          break;

        case InstructionCode.PLAN:
          this.performPlan(instruction);
          break;
        case InstructionCode.TRANSFORM:
          this.performTransform(instruction);
          break;
        case InstructionCode.BUILD:
          this.performBuild(instruction);
          break;
        case InstructionCode.ASYNC_BUILD:
          throw new AsyncUnsupportedError(instruction.serviceId);
        case InstructionCode.ASYNC_INTERCEPT:
          throw new AsyncUnsupportedError();
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
          code: InstructionCode.CONSTRUCT,
          cacheScope: Scope.TRANSIENT,
          constructor: target as Constructor,
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

  private performConstruction(instruction: ConstructInstruction) {
    const {paramCount, constructor, cacheScope, serviceId} = instruction;
    this.checkCache(cacheScope, serviceId);
    const args = this.stack.splice(this.stack.length - paramCount);
    const result = Reflect.construct(constructor, args);
    this.cacheIfNecessary(cacheScope, serviceId, result);
    this.stack.push(result);
    this.planingSet.delete(serviceId);
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

  private async performAsyncBuild(instruction: AsyncBuildInstruction) {
    const {paramCount, factory, cacheScope, serviceId} = instruction;
    this.checkCache(cacheScope, serviceId);
    const args = this.stack.splice(this.stack.length - paramCount);
    const result = await factory(...args);
    if (cacheScope === Scope.REQUEST) {
      this.requestSingletonCache.set(serviceId, result);
    }
    this.stack.push(result);
    this.planingSet.delete(serviceId);
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

  private async performIntercept(instruction: AsyncInterceptInstruction) {
    const {paramCount, interceptorBuilder} = instruction;

    const args = this.stack.splice(this.stack.length - paramCount);
    const interceptor = interceptorBuilder(...args);
    const cleanUp = this.dependentsCleanedUp;
    const allResolved = this.allResolved;
    this.allResolved = interceptor(
      () =>
        new Promise<void>((resolve) => {
          this.dependentsCleanedUp = resolve;
        }),
    ).finally(() => {
      if (cleanUp) {
        cleanUp();
      }
      return allResolved;
    });
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
    } else if (binding.type === BindingType.ASYNC_FACTORY) {
      this.compileProviderBinding(binding);
    }
    return this;
  }

  resolve<T>(serviceId: ServiceId<T>): T {
    return this.createResolveContext().resolve(serviceId);
  }

  resolveAsync<T>(serviceId: ServiceId<T>): Promise<T> {
    return this.createResolveContext().resolveAsync(serviceId);
  }

  private compileFactoryBinding<T>(binding: FactoryBinding<T>) {
    const {scope, paramInjectionMetadata, factory, id} = binding;
    this.compiledInstructionMap.set(id, [
      {
        code: InstructionCode.BUILD,
        serviceId: id,
        paramCount: paramInjectionMetadata.length,
        factory,
        cacheScope: scope,
      },
      ...compileParamInjectInstruction(paramInjectionMetadata),
    ]);
  }

  private compileInstanceBinding<T>(binding: InstanceBinding<T>) {
    const {scope, paramInjectionMetadata, constructor, id} = binding;
    this.compiledInstructionMap.set(id, [
      {
        code: InstructionCode.CONSTRUCT,
        cacheScope: scope,
        paramCount: paramInjectionMetadata.length,
        serviceId: id,
        constructor,
      },
      ...compileParamInjectInstruction(paramInjectionMetadata),
    ]);
  }

  private compileProviderBinding<T>(binding: AsyncFactoryBinding<T>) {
    const {scope, paramInjectionMetadata, factory, id} = binding;
    this.compiledInstructionMap.set(id, [
      {
        code: InstructionCode.ASYNC_BUILD,
        cacheScope: scope,
        paramCount: paramInjectionMetadata.length,
        serviceId: id,
        factory,
      },
      ...compileParamInjectInstruction(paramInjectionMetadata),
    ]);
  }
}
