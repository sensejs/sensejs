import {
  Binding,
  BindingType,
  Class,
  ClassServiceId,
  ConstantBinding,
  Constructor,
  GeneralServiceId,
  InjectScope,
  InvokeResult,
  ServiceId,
} from './types.js';
import {BuildInstruction, Instruction, InstructionCode, PlanInstruction, TransformInstruction} from './instructions.js';
import {
  convertParamInjectionMetadata,
  ensureConstructorParamInjectMetadata,
  ensureValidatedMethodInvokeProxy,
} from './metadata.js';
import {BindingNotFoundError} from './errors.js';
import {compileParamInjectInstruction, internalValidateDependencies} from './utils.js';

function constructorToFactory(constructor: Class) {
  return (...params: any[]) => Reflect.construct(constructor, params);
}

export class ResolveSession {
  readonly #instructions: Instruction[] = [];
  readonly #sessionCache: Map<any, any> = new Map();
  readonly #temporaryBinding: Map<ServiceId, ConstantBinding<any>> = new Map();
  readonly #bindingMap: Map<ServiceId, Binding<any>>;
  readonly #compiledInstructionMap: Map<ServiceId, Instruction[]>;
  readonly #globalCache: Map<any, any>;
  readonly #validatedSet: Set<ServiceId>;
  readonly #stack: any[] = [];

  constructor(
    bindingMap: Map<ServiceId, Binding<any>>,
    compiledInstructionMap: Map<ServiceId, Instruction[]>,
    globalCache: Map<any, any>,
    validatedSet: Set<ServiceId>,
  ) {
    this.#bindingMap = bindingMap;
    this.#compiledInstructionMap = compiledInstructionMap;
    this.#globalCache = globalCache;
    this.#validatedSet = validatedSet;
  }

  invoke<T extends {}, K extends keyof T>(target: Constructor<T>, key: K): InvokeResult<T, K> {
    const [proxy, fn] = ensureValidatedMethodInvokeProxy(target, key);
    const self = this.resolve(target) as T;
    const proxyInstance = this.construct(proxy);
    return proxyInstance.call(fn, self);
  }

  public addTemporaryConstantBinding<T>(serviceId: GeneralServiceId<T>, value: T): this;
  public addTemporaryConstantBinding<T extends {}>(serviceId: ClassServiceId<T>, value: T): this;
  public addTemporaryConstantBinding<T>(serviceId: ServiceId<T>, value: T): this {
    this.#temporaryBinding.set(serviceId, {
      type: BindingType.CONSTANT,
      id: serviceId,
      value,
    });
    this.#sessionCache.set(serviceId, value);
    return this;
  }

  resolve<T>(target: GeneralServiceId<T>): T;
  resolve<T extends {}>(target: ClassServiceId<T>): T;
  resolve<T>(target: ServiceId<T>): T {
    this.#performPlan({code: InstructionCode.PLAN, optional: false, target, allowTemporary: true});
    return this.evalInstructions();
  }

  construct<T extends {}>(target: Constructor<T>): T {
    this.#performPlan({code: InstructionCode.PLAN, optional: false, target, allowTemporary: true}, true);
    return this.evalInstructions();
  }

  protected evalInstructions(instruction: Instruction[] = []): any {
    this.#instructions.push(...instruction);
    for (;;) {
      const instruction = this.#instructions.pop();
      if (!instruction) {
        return this.#stack.pop();
      }

      switch (instruction.code) {
        case InstructionCode.PLAN:
          this.#performPlan(instruction, false);
          break;
        case InstructionCode.TRANSFORM:
          this.#performTransform(instruction);
          break;
        case InstructionCode.BUILD:
          this.#performBuild(instruction);
          break;
      }
    }
  }

  #performPlan(instruction: PlanInstruction, allowUnbound = false): void {
    const {target, optional, allowTemporary} = instruction;
    /**
     * Middlewares may directly put something into session cache, we need to
     * check the cache first, otherwise a BindingNotFoundError may be thrown
     */
    if (this.#resolveFromCache(target)) {
      return;
    }
    const binding = this.#getBindingForPlan(target, optional, allowUnbound, allowTemporary);
    if (!binding) {
      return;
    }
    if (this.#resolveFromCache(binding.id)) {
      return;
    }
    switch (binding.type) {
      case BindingType.CONSTANT:
        this.#stack.push(binding.value);
        break;
      case BindingType.INSTANCE:
      case BindingType.FACTORY:
        {
          const instructions = this.#compiledInstructionMap.get(binding.id);
          if (!instructions) {
            throw new Error('BUG: No compiled instruction found');
          }
          this.#instructions.push(...instructions);
        }
        break;
    }
  }

  /**
   * Get binding and resolve alias
   * @param target
   * @param allowTemporary
   * @private
   */
  #internalGetBinding(target: ServiceId, allowTemporary: boolean) {
    for (;;) {
      if (allowTemporary) {
        const temporaryBinding = this.#temporaryBinding.get(target);
        if (temporaryBinding) {
          return temporaryBinding;
        }
      }
      const binding = this.#bindingMap.get(target);
      if (!binding) {
        return;
      }
      if (binding.type !== BindingType.ALIAS) {
        return binding;
      }
      target = binding.canonicalId;
    }
  }

  #resolveFromCache(target: ServiceId) {
    if (this.#globalCache.has(target)) {
      this.#stack.push(this.#globalCache.get(target));
      return true;
    } else if (this.#sessionCache.has(target)) {
      this.#stack.push(this.#sessionCache.get(target));
      return true;
    }
    return false;
  }

  #getBindingForPlan(target: ServiceId, optionalInject: boolean, allowUnbound: boolean, allowTemporary: boolean) {
    if (!this.#validatedSet) {
      internalValidateDependencies(target, this.#bindingMap, [], this.#validatedSet);
    }
    const binding = this.#internalGetBinding(target, allowTemporary);
    if (binding) {
      return binding;
    }
    if (optionalInject) {
      this.#stack.push(undefined);
      return;
    } else if (allowUnbound && typeof target === 'function') {
      const cm = convertParamInjectionMetadata(ensureConstructorParamInjectMetadata(target));
      this.#instructions.push(
        {
          code: InstructionCode.BUILD,
          cacheScope: InjectScope.TRANSIENT,
          factory: constructorToFactory(target),
          paramCount: cm.length,
          serviceId: target,
        },
        ...compileParamInjectInstruction(cm, allowTemporary),
      );
      return;
    }
    throw new BindingNotFoundError(target);
  }

  #performTransform(instruction: TransformInstruction) {
    const {transformer} = instruction;
    this.#stack[this.#stack.length - 1] = transformer(this.#stack[this.#stack.length - 1]);
  }

  #performBuild(instruction: BuildInstruction) {
    const {paramCount, factory, cacheScope, serviceId} = instruction;
    const args = this.#stack.splice(this.#stack.length - paramCount);
    const result = factory(...args);
    this.#cacheIfNecessary(cacheScope, serviceId, result);
    this.#stack.push(result);
  }

  #cacheIfNecessary(cacheScope: InjectScope, serviceId: ServiceId, result: any) {
    if (cacheScope === InjectScope.SESSION) {
      this.#sessionCache.set(serviceId, result);
    } else if (cacheScope === InjectScope.SINGLETON) {
      this.#globalCache.set(serviceId, result);
    }
  }
}
