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
import {Injectable} from './decorator';
import {Resolver} from './resolver';

const METADATA_KEY = Symbol();

type ServiceTypeOf<T extends any[]> = T extends [ServiceId<infer P>, ...infer Q] ? [P, ...ServiceTypeOf<Q>] : [];

export function InterceptProviderClass<T extends ServiceId[]>(...serviceIds: T) {
  return <U extends Constructor<AsyncInterceptProvider<any, ServiceTypeOf<T>>>>(constructor: U): U => {
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

class AsyncMethodInvokeSession<Context, T extends {}, K extends keyof T> extends Resolver {
  private readonly context: Context;
  private result?: InvokeResult<T, K>;

  constructor(
    bindingMap: Map<ServiceId, Binding<any>>,
    compiledInstructionMap: Map<ServiceId, Instruction[]>,
    globalCache: Map<any, any>,
    readonly interceptProviderAndMetadata: [Constructor<AsyncInterceptProvider<Context, any[]>>, ServiceId[]][],
    private readonly proxyConstructInstructions: Instruction[],
    private readonly targetConstructor: Constructor,
    private readonly targetFunction: Function,
    contextProviderInstructions: Instruction[],
  ) {
    super(bindingMap, compiledInstructionMap, globalCache);
    this.instructions.push(...contextProviderInstructions);
    this.context = this.evalInstructions();
  }

  async invoke(): Promise<InvokeResult<T, K>> {
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
        const [interceptResolver, metadata] = this.interceptProviderAndMetadata[index];

        return this.resolve(interceptResolver).intercept(this.context, async (...args: any[]) => {
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

export class MethodInvoker<Context, T extends {}, K extends keyof T> {
  private readonly proxyConstructInstructions: Instruction[];
  private readonly targetFunction: Function;
  private readonly interceptorProviderAndMetadata: [Constructor<AsyncInterceptProvider<Context, any>>, ServiceId[]][];
  private readonly contextProviderInstructions: Instruction[];

  constructor(
    readonly bindingMap: Map<ServiceId, Binding<any>>,
    readonly compiledInstructionMap: Map<ServiceId, Instruction[]>,
    private globalCache: Map<ServiceId, any>,
    private targetConstructor: Constructor<T>,
    private targetMethod: K,
    private contextProvider: {
      factory: (...args: any[]) => Context;
      paramInjectionMetadata: ParamInjectionMetadata[];
    },
    interceptors: Constructor<AsyncInterceptProvider<any, any>>[],
  ) {
    const [proxy, fn] = ensureValidatedMethodInvokeProxy(targetConstructor, targetMethod);
    const cm = convertParamInjectionMetadata(ensureConstructorParamInjectMetadata(proxy));
    this.proxyConstructInstructions = [
      {
        code: InstructionCode.BUILD,
        cacheScope: InjectScope.TRANSIENT,
        factory: constructorToFactory(proxy),
        paramCount: cm.length,
        serviceId: proxy,
      },
      ...compileParamInjectInstruction(cm, true),
    ];
    this.targetFunction = fn;
    this.interceptorProviderAndMetadata = interceptors.map((x) => [x, Reflect.getOwnMetadata(METADATA_KEY, x)]);
    this.contextProviderInstructions = [
      {
        code: InstructionCode.BUILD,
        cacheScope: InjectScope.TRANSIENT,
        factory: contextProvider.factory,
        paramCount: contextProvider.paramInjectionMetadata.length,
        serviceId: Symbol(),
      },
      ...compileParamInjectInstruction(contextProvider.paramInjectionMetadata, true),
    ];
  }

  invoke() {
    return new AsyncMethodInvokeSession(
      this.bindingMap,
      this.compiledInstructionMap,
      this.globalCache,
      this.interceptorProviderAndMetadata,
      this.proxyConstructInstructions,
      this.targetConstructor,
      this.targetFunction,
      this.contextProviderInstructions,
    ).invoke();
  }
}
