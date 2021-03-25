import {Class, Constructor} from '@sensejs/utility';
import {BindingType, ParamInjectionMetadata, Scope, ServiceId} from './types';
import {ensureConstructorParamInjectMetadata} from './decorator';

export interface ConstantBinding<T> {
  type: BindingType.CONSTANT;
  id: ServiceId<T>;
  value: T;
}

export interface InstanceBinding<T> {
  type: BindingType.INSTANCE;
  id: ServiceId<T>;
  constructor: Constructor<T>;
  paramInjectionMetadata: ParamInjectionMetadata<any>[];
  scope: Scope;
}

export interface FactoryBinding<T> {
  type: BindingType.FACTORY;
  id: ServiceId<T>;
  scope: Scope;
  factory: (...args: any[]) => T;
  paramInjectionMetadata: ParamInjectionMetadata<any>[];
}

export interface AsyncFactoryBinding<T> {
  type: BindingType.ASYNC_FACTORY;
  id: ServiceId<T>;
  scope: Scope.REQUEST | Scope.TRANSIENT;
  factory: (...args: any[]) => Promise<T>;
  paramInjectionMetadata: ParamInjectionMetadata<any>[];
}

export type ResolveInterceptor = (
  provide: <R>(serviceId: ServiceId<R>, value: R) => void,
  next: () => Promise<void>,
) => Promise<any>;

export interface ResolveInterceptorFactory<T> {
  interceptorBuilder: (...args: any[]) => ResolveInterceptor;
  paramInjectionMetadata: ParamInjectionMetadata<any>[];
}

export interface AliasBinding<T> {
  type: BindingType.ALIAS;
  id: ServiceId<T>;
  canonicalId: ServiceId<any>;
}

export type Binding<T> =
  | ConstantBinding<T>
  | InstanceBinding<T>
  | FactoryBinding<T>
  | AsyncFactoryBinding<T>
  | AliasBinding<T>;

export class InvalidParamBindingError extends Error {
  constructor(readonly received: ParamInjectionMetadata<any>[], readonly invalidIndex: number) {
    super();
    Error.captureStackTrace(this, InvalidParamBindingError);
  }
}
export class DuplicatedBindingError extends Error {
  constructor(readonly serviceId: ServiceId<any>) {
    super();
    Error.captureStackTrace(this, DuplicatedBindingError);
  }
}
export class CircularAliasError extends Error {
  constructor(readonly serviceId: ServiceId<any>) {
    super();
    Error.captureStackTrace(this, CircularAliasError);
  }
}

export class CircularDependencyError extends Error {
  constructor(readonly serviceId: ServiceId<any>) {
    super();
    Error.captureStackTrace(this, CircularDependencyError);
  }
}

export class BindingNotFoundError extends Error {
  constructor(readonly serviceId: ServiceId<any>) {
    super();
    Error.captureStackTrace(this, BindingNotFoundError);
  }
}

export class AsyncUnsupportedError extends Error {
  constructor(readonly serviceId?: ServiceId<any>) {
    super();
    Error.captureStackTrace(this, AsyncUnsupportedError);
  }
}

enum InstructionCode {
  PLAN = 'PLAN',
  CONSTRUCT = 'CONSTRUCT',
  TRANSFORM = 'TRANSFORM',
  BUILD = 'BUILD',
  ASYNC_BUILD = 'ASYNC_BUILD',
  ASYNC_INTERCEPT = 'ASYNC_INTERCEPT',
}

interface PlanInstruction {
  code: InstructionCode.PLAN;
  target: ServiceId<any>;
  optional: boolean;
}

interface ConstructInstruction {
  code: InstructionCode.CONSTRUCT;
  serviceId: ServiceId<any>;
  constructor: Constructor<any>;
  paramCount: number;
  cacheScope: Scope;
}

interface BuildInstruction {
  code: InstructionCode.BUILD;
  serviceId: ServiceId<any>;
  factory: (...args: any[]) => any;
  paramCount: number;
  cacheScope: Scope;
}

interface AsyncBuildInstruction {
  code: InstructionCode.ASYNC_BUILD;
  serviceId: ServiceId<any>;
  factory: (...args: any[]) => any;
  paramCount: number;
  cacheScope: Scope.REQUEST | Scope.TRANSIENT;
}

interface AsyncInterceptInstruction {
  code: InstructionCode.ASYNC_INTERCEPT;
  interceptorBuilder: (...args: any[]) => ResolveInterceptor;
  paramCount: number;
}

interface TransformInstruction {
  code: InstructionCode.TRANSFORM;
  transformer: (input: any) => any;
}

export type Instruction =
  | PlanInstruction
  | ConstructInstruction
  | BuildInstruction
  | TransformInstruction
  | AsyncBuildInstruction
  | AsyncInterceptInstruction;

function verifyParamInjectAndCompile(
  paramInjectionMetadata: ParamInjectionMetadata<any>[],
  consumingInstruction: Instruction,
) {
  const sortedMetadata = Array.from(paramInjectionMetadata).sort((l, r) => l.index - r.index);
  sortedMetadata.forEach((value, index) => {
    if (value.index !== index) {
      throw new InvalidParamBindingError(sortedMetadata, index);
    }
  });
  return sortedMetadata.reduceRight(
    (instructions, m): Instruction[] => {
      const {id, transform, optional} = m;
      if (typeof transform === 'function') {
        instructions.push({code: InstructionCode.TRANSFORM, transformer: transform});
      }
      instructions.push({code: InstructionCode.PLAN, target: id, optional});
      return instructions;
    },
    [consumingInstruction],
  );
}

class ResolveContext {
  private readonly planingSet: Set<ServiceId<any>> = new Set();
  private readonly instructions: Instruction[] = [];
  private readonly requestSingletonCache: Map<any, any> = new Map();
  private readonly stack: any[] = [];
  private readonly interceptorFactories: ResolveInterceptorFactory<any>[] = [];
  private cleanUp?: () => void;
  private allResolved = Promise.resolve();

  constructor(
    readonly bindingMap: Map<ServiceId<any>, Binding<any>>,
    readonly compiledInstructionMap: Map<ServiceId<any>, Instruction[]>,
    readonly globalSingletonCache: Map<any, any>,
  ) {}

  async wait() {
    if (this.cleanUp) {
      this.cleanUp();
      this.cleanUp = undefined;
    }
    return this.allResolved;
  }

  addResolveInterceptor(interceptorFactory: ResolveInterceptorFactory<any>) {
    this.interceptorFactories.push(interceptorFactory);
    return this;
  }

  async resolveAsync(target: ServiceId<any>) {
    this.performPlan({code: InstructionCode.PLAN, optional: false, target});
    this.interceptorFactories.reduceRight((output, i) => {
      this.instructions.push(...this.compileInterceptor(i));
      return null;
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

  resolve(target: ServiceId<any>) {
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

  private compileInterceptor(interceptorFactory: ResolveInterceptorFactory<any>) {
    const {interceptorBuilder, paramInjectionMetadata} = interceptorFactory;
    return verifyParamInjectAndCompile(interceptorFactory.paramInjectionMetadata, {
      code: InstructionCode.ASYNC_INTERCEPT,
      interceptorBuilder: interceptorBuilder,
      paramCount: paramInjectionMetadata.length,
    });
  }

  /**
   * Get binding and resolve alias
   * @param target
   * @private
   */
  private internalGetBinding(target: ServiceId<any>) {
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

  private resolveFromCache(target: ServiceId<any>) {
    if (this.globalSingletonCache.has(target)) {
      this.stack.push(this.globalSingletonCache.get(target));
      return true;
    } else if (this.requestSingletonCache.has(target)) {
      this.stack.push(this.requestSingletonCache.get(target));
      return true;
    }
    return false;
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
    const binding = this.internalGetBinding(target);
    if (!binding) {
      if (optional) {
        this.stack.push(undefined);
        return;
      } else {
        throw new BindingNotFoundError(target);
      }
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
          this.planingSet.add(target);
          const instructions = this.compiledInstructionMap.get(target);
          if (!instructions) {
            throw new Error('BUG: No compiled instruction found');
          }
          this.instructions.push(...instructions);
        }
        break;
      case BindingType.ASYNC_FACTORY:
        {
          this.planingSet.add(target);
          const instructions = this.compiledInstructionMap.get(target);
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
    if (cacheScope === Scope.REQUEST) {
      this.requestSingletonCache.set(serviceId, result);
    } else if (cacheScope === Scope.SINGLETON) {
      this.globalSingletonCache.set(serviceId, result);
    }
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
    if (cacheScope === Scope.REQUEST) {
      this.requestSingletonCache.set(serviceId, result);
    } else if (cacheScope === Scope.SINGLETON) {
      this.globalSingletonCache.set(serviceId, result);
    }
    this.stack.push(result);
    this.planingSet.delete(serviceId);
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

  private checkCache(cacheScope: Scope, serviceId: Class<any> | string | symbol) {
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

  private async performIntercept(instruction: AsyncInterceptInstruction) {
    const {paramCount, interceptorBuilder} = instruction;

    const args = this.stack.splice(this.stack.length - paramCount);
    const interceptor = interceptorBuilder(...args);
    const cleanUp = this.cleanUp;
    const allResolved = this.allResolved;
    this.allResolved = interceptor(
      (serviceId, value) => {
        this.requestSingletonCache.set(serviceId, value);
      },
      () =>
        new Promise<void>((resolve) => {
          this.cleanUp = resolve;
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
  private bindingMap: Map<ServiceId<any>, Binding<any>> = new Map();
  private compiledInstructionMap: Map<ServiceId<any>, Instruction[]> = new Map();
  private singletonCache: Map<ServiceId<any>, any> = new Map();

  createResolveContext() {
    return new ResolveContext(this.bindingMap, this.compiledInstructionMap, this.singletonCache);
  }

  add(ctor: Constructor) {
    const cm = ensureConstructorParamInjectMetadata(ctor);
    this.addBinding({
      type: BindingType.INSTANCE,
      id: ctor,
      constructor: ctor,
      scope: cm.scope,
      paramInjectionMetadata: Array.from(cm.params.entries()).map(
        ([index, value]): ParamInjectionMetadata<any> => {
          const {id, transform, optional = false} = value;
          if (typeof id === 'undefined') {
            throw new TypeError('param inject id is undefined');
          }
          return {
            index,
            id,
            transform,
            optional,
          };
        },
      ),
    });
  }

  addBinding<T>(binding: Binding<T>) {
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
  }

  resolve<T>(serviceId: ServiceId<T>): T {
    return this.createResolveContext().resolve(serviceId);
  }

  resolveAsync<T>(serviceId: ServiceId<T>): Promise<T> {
    return this.createResolveContext().resolveAsync(serviceId);
  }

  private compileFactoryBinding<T>(binding: FactoryBinding<T>) {
    const {scope, paramInjectionMetadata, factory, id} = binding;
    const compiledInstructions = verifyParamInjectAndCompile(paramInjectionMetadata, {
      code: InstructionCode.BUILD,
      serviceId: id,
      paramCount: paramInjectionMetadata.length,
      factory,
      cacheScope: scope,
    });

    this.compiledInstructionMap.set(id, compiledInstructions);
  }

  private compileInstanceBinding<T>(binding: InstanceBinding<T>) {
    const {scope, paramInjectionMetadata, constructor, id} = binding;
    const planInstructions = verifyParamInjectAndCompile(paramInjectionMetadata, {
      code: InstructionCode.CONSTRUCT,
      cacheScope: scope,
      paramCount: paramInjectionMetadata.length,
      serviceId: id,
      constructor,
    });
    this.compiledInstructionMap.set(id, planInstructions);
  }

  private compileProviderBinding<T>(binding: AsyncFactoryBinding<T>) {
    const {scope, paramInjectionMetadata, factory, id} = binding;
    const planInstructions = verifyParamInjectAndCompile(paramInjectionMetadata, {
      code: InstructionCode.ASYNC_BUILD,
      cacheScope: scope,
      paramCount: paramInjectionMetadata.length,
      serviceId: id,
      factory,
    });
    this.compiledInstructionMap.set(id, planInstructions);
  }
}
