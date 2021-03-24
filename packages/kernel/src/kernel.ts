import {Class, Constructor} from '@sensejs/utility';

export type ServiceId<T> = Class<T> | string | symbol;

export enum BindingType {
  CONSTANT = 'CONSTANT',
  INSTANCE = 'INSTANCE',
  FACTORY = 'FACTORY',
  ALIAS = 'ALIAS',
}

export enum Scope {
  SINGLETON = 'SINGLETON',
  REQUEST = 'REQUEST',
  TRANSIENT = 'TRANSIENT',
}

export function untransformed<T>(input: T) {
  return input;
}

export interface ParamInjectionMetadata<T> {
  index: number;
  id: ServiceId<T>;
  optional: boolean;
  transform?: (input: T) => any;
}

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
  factoryParamInjectionMetadata: ParamInjectionMetadata<any>[];
}

export interface AliasBinding<T> {
  type: BindingType.ALIAS;
  id: ServiceId<T>;
  canonicalId: ServiceId<any>;
}

export type Binding<T> = ConstantBinding<T> | InstanceBinding<T> | FactoryBinding<T> | AliasBinding<T>;

interface CompiledInstanceBinding<T> {
  type: BindingType.INSTANCE;
  id: ServiceId<T>;
  instructions: Instruction[];
}

type CompiledBinding<T> = ConstantBinding<T> | CompiledInstanceBinding<T> | FactoryBinding<T> | AliasBinding<T>;

export enum InstructionCode {
  PLAN = 'PLAN',
  CONSTRUCT = 'CONSTRUCT',
  TRANSFORM = 'TRANSFORM',
  BUILD = 'BUILD',
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

interface TransformInstruction {
  code: InstructionCode.TRANSFORM;
  transformer: (input: any) => any;
}

export type Instruction = PlanInstruction | ConstructInstruction | BuildInstruction | TransformInstruction;

class ResolveContext {
  readonly planingSet: Set<ServiceId<any>> = new Set();
  readonly instructions: Instruction[] = [];
  readonly requestSingletonCache: Map<any, any> = new Map();
  readonly stack: any[] = [];

  constructor(
    readonly bindingMap: Map<ServiceId<any>, Binding<any>>,
    readonly globalSingletonCache: Map<any, any>,
    readonly target: ServiceId<any>,
  ) {
    this.performPlan({code: InstructionCode.PLAN, optional: false, target});
  }

  resolve() {
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
        default: {
          const never: never = instruction;
        }
      }
    }
  }

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
        throw new Error('circular alias');
      }
      resolvingSet.add(target);
    }
  }

  private performPlan(instruction: PlanInstruction) {
    const {target, optional} = instruction;
    if (this.planingSet.has(target)) {
      throw new Error('circular detected');
    }
    const binding = this.internalGetBinding(target);
    if (!binding) {
      if (optional) {
        this.stack.push(undefined);
        return;
      } else {
        throw new Error('No binding found');
      }
    }
    switch (binding.type) {
      case BindingType.CONSTANT:
        this.stack.push(binding.value);
        break;
      case BindingType.INSTANCE:
        {
          const {constructor, paramInjectionMetadata, scope, id} = binding;
          if (scope === Scope.SINGLETON) {
            if (this.globalSingletonCache.has(id)) {
              this.stack.push(this.globalSingletonCache.get(id));
              return;
            }
          } else if (scope === Scope.REQUEST) {
            if (this.requestSingletonCache.has(id)) {
              this.stack.push(this.requestSingletonCache.get(id));
              return;
            }
          }
          this.planingSet.add(target);
          this.instructions.push({
            code: InstructionCode.CONSTRUCT,
            constructor,
            serviceId: target,
            paramCount: paramInjectionMetadata.length,
            cacheScope: scope,
          });
          paramInjectionMetadata.reduceRight((unused, pim) => {
            const {id, optional} = pim;
            this.instructions.push({
              code: InstructionCode.PLAN,
              target: id,
              optional,
            });
            return null;
          }, null);
        }
        break;
      case BindingType.FACTORY: {
        throw new Error('Unsupported');
      }
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

  private checkCache(cacheScope: Scope, serviceId: Class<any> | string | symbol) {
    if (cacheScope === Scope.SINGLETON) {
      if (this.globalSingletonCache.has(serviceId)) {
        throw new Error('Reconstruct a global singleton');
      }
    }

    if (cacheScope === Scope.REQUEST) {
      if (this.requestSingletonCache.has(serviceId)) {
        throw new Error('Reconstruct a request-scope singleton');
      }
    }
  }
}

export class Kernel {
  private bindingMap: Map<ServiceId<any>, Binding<any>> = new Map();
  private resolvePlanMap: Map<ServiceId<any>, Instruction[]> = new Map();
  private singletonCache: Map<ServiceId<any>, any> = new Map();

  addBinding<T>(binding: Binding<T>) {
    const id = binding.id;
    if (this.bindingMap.has(id)) {
      throw new Error('Duplicated');
    }
    this.bindingMap.set(id, binding);

    if (binding.type === BindingType.INSTANCE) {
      this.compileInstanceBinding(binding);
    } else if (binding.type === BindingType.FACTORY) {
      this.compileFactoryBinding(binding);
    }
  }

  private compileFactoryBinding<T>(binding: FactoryBinding<T>) {
    const {scope, factoryParamInjectionMetadata, factory, id} = binding;
    const compiledInstructions = this.verifyAndCompileToInstruction(factoryParamInjectionMetadata, {
      code: InstructionCode.BUILD,
      serviceId: id,
      paramCount: factoryParamInjectionMetadata.length,
      factory,
      cacheScope: scope,
    });

    this.resolvePlanMap.set(id, compiledInstructions);
  }

  private verifyAndCompileToInstruction(
    paramInjectionMetadata: ParamInjectionMetadata<any>[],
    consumingInstruction: Instruction,
  ) {
    const sortedMetadata = Array.from(paramInjectionMetadata).sort((l, r) => l.index - r.index);
    sortedMetadata.forEach((value, index) => {
      if (value.index !== index) {
        throw new Error('param inject metadata is invalid');
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

  private compileInstanceBinding<T>(binding: InstanceBinding<T>) {
    const {scope, paramInjectionMetadata, constructor, id} = binding;
    const planInstructions = this.verifyAndCompileToInstruction(paramInjectionMetadata, {
      code: InstructionCode.CONSTRUCT,
      cacheScope: scope,
      paramCount: paramInjectionMetadata.length,
      serviceId: id,
      constructor,
    });
    this.resolvePlanMap.set(id, planInstructions);
  }

  resolve<T>(serviceId: ServiceId<T>): T {
    const requestContext = new ResolveContext(this.bindingMap, this.singletonCache, serviceId);
    return requestContext.resolve();
  }
}
