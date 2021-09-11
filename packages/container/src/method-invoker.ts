import {
  AsyncInterceptProvider,
  Binding,
  Class,
  Constructor,
  InjectScope,
  InvokeResult,
  ParamInjectionMetadata,
  ServiceId,
} from './types';
import {Instruction, InstructionCode} from './instructions';
import {
  convertParamInjectionMetadata,
  ensureConstructorParamInjectMetadata,
  ensureValidatedMethodInvokeProxy,
  ensureValidatedParamInjectMetadata,
  MethodInvokeProxy,
} from './metadata';
import {Injectable, Scope} from './decorator';
import {ResolveSession} from './resolve-session';
import {BindingNotFoundError} from './errors';

const METADATA_KEY = Symbol();

type ServiceTypeOf<T extends any[]> = T extends [ServiceId<infer P>, ...infer Q] ? [P, ...ServiceTypeOf<Q>] : [];

export function InterceptProviderClass<T extends ServiceId[]>(...serviceIds: T) {
  return <U extends Constructor<AsyncInterceptProvider<ServiceTypeOf<T>>>>(constructor: U): U => {
    Reflect.defineMetadata(METADATA_KEY, serviceIds, constructor);
    Injectable()(constructor);
    return constructor;
  };
}

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

export class AsyncMethodInvokeSession<
  T extends {},
  K extends keyof T,
  ContextIds extends any[] = [],
> extends ResolveSession {
  private result?: InvokeResult<T, K>;
  private contextIds: ContextIds;

  constructor(
    bindingMap: Map<ServiceId, Binding<any>>,
    compiledInstructionMap: Map<ServiceId, Instruction[]>,
    globalCache: Map<any, any>,
    readonly interceptProviderAndMetadata: [Instruction[], ServiceId[]][],
    private readonly proxyConstructInstructions: Instruction[],
    private readonly targetConstructor: Constructor,
    private readonly targetFunction: Function,
    ...contextIds: ContextIds
  ) {
    super(bindingMap, compiledInstructionMap, globalCache);
    this.contextIds = contextIds;
  }

  async invokeTargetMethod(...ctx: ServiceTypeOf<ContextIds>): Promise<InvokeResult<T, K>> {
    for (let i = 0; i < ctx.length && i < this.contextIds.length; i++) {
      this.addTemporaryConstantBinding(this.contextIds[i], ctx[i]);
    }
    const performInvoke = (): Promise<InvokeResult<T, K>> => {
      this.performPlan({
        code: InstructionCode.PLAN,
        optional: false,
        target: this.targetConstructor,
        allowTemporary: false,
      });
      const self = this.evalInstructions() as T;
      this.instructions.push(...this.proxyConstructInstructions);
      const proxyInstance = this.evalInstructions() as MethodInvokeProxy;
      return proxyInstance.call(this.targetFunction, self);
    };
    return new Promise<InvokeResult<T, K>>((resolve, reject) => {
      const intercept = async (index: number): Promise<void> => {
        if (index === this.interceptProviderAndMetadata.length) {
          this.result = await performInvoke();
          return;
        }
        const [instructions, metadata] = this.interceptProviderAndMetadata[index];
        this.instructions.push(...instructions);
        const instance = this.evalInstructions() as AsyncInterceptProvider<any>;

        return instance.intercept(async (...args: any[]) => {
          for (let i = 0; i < metadata.length; i++) {
            this.addTemporaryConstantBinding(metadata[i], args[i]);
          }

          await intercept(index + 1);
        });
      };
      intercept(0).then(() => resolve(this.result!), reject);
    });
  }
}

export class MethodInvoker<T extends {}, K extends keyof T, ContextIds extends any[]> {
  private readonly proxyConstructInstructions: Instruction[];
  private readonly targetFunction: Function;
  private readonly interceptorProviderAndMetadata: [Instruction[], ServiceId[]][] = [];
  private readonly proxyConstructorInjectionMetadata;
  private contextIds;

  constructor(
    readonly bindingMap: Map<ServiceId, Binding<any>>,
    readonly compiledInstructionMap: Map<ServiceId, Instruction[]>,
    private globalCache: Map<ServiceId, any>,
    private targetConstructor: Constructor<T>,
    private targetMethod: K,
    private interceptors: Constructor<AsyncInterceptProvider<any>>[],
    ...contextIds: ContextIds
  ) {
    this.contextIds = contextIds;
    const [proxy, fn] = ensureValidatedMethodInvokeProxy(targetConstructor, targetMethod);
    this.proxyConstructorInjectionMetadata = convertParamInjectionMetadata(ensureConstructorParamInjectMetadata(proxy));
    this.validate();
    this.proxyConstructInstructions = [
      {
        code: InstructionCode.BUILD,
        cacheScope: InjectScope.TRANSIENT,
        factory: constructorToFactory(proxy),
        paramCount: this.proxyConstructorInjectionMetadata.length,
        serviceId: proxy,
      },
      ...compileParamInjectInstruction(this.proxyConstructorInjectionMetadata, true),
    ];
    this.targetFunction = fn;
  }

  createInvokeSession() {
    return new AsyncMethodInvokeSession(
      this.bindingMap,
      this.compiledInstructionMap,
      this.globalCache,
      this.interceptorProviderAndMetadata,
      this.proxyConstructInstructions,
      this.targetConstructor,
      this.targetFunction,
      ...this.contextIds,
    );
  }

  private validate() {
    const validatedSet = new Set(new Map(this.bindingMap).keys());
    this.contextIds.forEach((id) => validatedSet.add(id));
    const validateParamInjectMetadata = (metadata: ParamInjectionMetadata[], name: string) => {
      metadata.forEach((v, idx) => {
        const {id, optional = false} = v;
        if (typeof id === 'undefined') {
          throw new TypeError('param inject id is undefined');
        }
        if (!validatedSet.has(id)) {
          if (optional) {
            return;
          }
          throw new BindingNotFoundError(`binding not found for parameters[${idx}/${metadata.length - 1}] of ${name}`);
        }
      });
    };
    for (const interceptor of this.interceptors) {
      const pim = convertParamInjectionMetadata(ensureConstructorParamInjectMetadata(interceptor));
      validateParamInjectMetadata(pim, interceptor.name);
      const metadata = Reflect.getOwnMetadata(METADATA_KEY, interceptor);
      if (!Array.isArray(metadata)) {
        throw new Error('missing metadata');
      }
      metadata.forEach((x) => validatedSet.add(x));
      this.interceptorProviderAndMetadata.push([
        [
          {
            code: InstructionCode.BUILD,
            paramCount: pim.length,
            factory: (...args) => Reflect.construct(interceptor, args),
            serviceId: Symbol(),
            cacheScope: Scope.SINGLETON,
          },
          ...compileParamInjectInstruction(pim, true),
        ],
        metadata,
      ]);
    }
    validateParamInjectMetadata(
      this.proxyConstructorInjectionMetadata,
      `${this.targetConstructor.name}.${this.targetMethod}`,
    );
  }
}
