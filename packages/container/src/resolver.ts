import {
  Binding,
  BindingType,
  Class,
  ConstantBinding,
  Constructor,
  InjectScope,
  ParamInjectionMetadata,
  ServiceId,
} from './types';
import {BuildInstruction, Instruction, InstructionCode, PlanInstruction, TransformInstruction} from './instructions';
import {
  convertParamInjectionMetadata,
  ensureConstructorParamInjectMetadata,
  ensureValidatedParamInjectMetadata,
} from './metadata';
import {BindingNotFoundError, CircularAliasError, CircularDependencyError} from './errors';

export function compileParamInjectInstruction(
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

export class Resolver {
  protected readonly instructions: Instruction[] = [];
  protected readonly planingSet: Set<ServiceId> = new Set();
  protected readonly sessionCache: Map<any, any> = new Map();
  protected readonly temporaryBinding: Map<ServiceId, ConstantBinding<any>> = new Map();
  protected readonly stack: any[] = [];

  constructor(
    readonly bindingMap: Map<ServiceId, Binding<any>>,
    readonly compiledInstructionMap: Map<ServiceId, Instruction[]>,
    readonly globalCache: Map<any, any>,
  ) {}

  /**
   * Validate all dependencies between components are met and there is no circular
   */
  validate() {
    const set = new Set<ServiceId>();
    this.bindingMap.forEach((binding) => this.internalValidateDependencies(binding, [], set));
  }

  public addTemporaryConstantBinding<T>(serviceId: ServiceId<T>, value: T): this {
    this.temporaryBinding.set(serviceId, {
      type: BindingType.CONSTANT,
      id: serviceId,
      value,
    });
    return this;
  }

  resolve<T>(target: ServiceId<T>, allowTemporary: boolean = true): T {
    this.performPlan({code: InstructionCode.PLAN, optional: false, target, allowTemporary});
    return this.evalInstructions();
  }

  construct<T>(target: Constructor<T>): T {
    this.performPlan({code: InstructionCode.PLAN, optional: false, target, allowTemporary: true}, true);
    return this.evalInstructions();
  }

  protected resetState() {
    /** Clear stack */
    this.stack.splice(0);
  }

  protected evalInstructions() {
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

  protected performPlan(instruction: PlanInstruction, allowUnbound = false, allowAsync = false) {
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
    switch (binding.type) {
      case BindingType.CONSTANT:
        this.stack.push(binding.value);
        break;
      case BindingType.INSTANCE:
      case BindingType.FACTORY:
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

  private performTransform(instruction: TransformInstruction) {
    const {transformer} = instruction;
    this.stack[this.stack.length - 1] = transformer(this.stack[this.stack.length - 1]);
  }

  private performBuild(instruction: BuildInstruction) {
    const {paramCount, factory, cacheScope, serviceId} = instruction;
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
}
