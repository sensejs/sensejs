import {
  AsyncInterceptProvider,
  Binding,
  Class,
  Constructor,
  InjectScope,
  InvokeResult,
  ParamInjectionMetadata,
  ServiceId,
} from './types.js';
import {Instruction, InstructionCode} from './instructions.js';
import {
  convertParamInjectionMetadata,
  ensureConstructorParamInjectMetadata,
  ensureValidatedMethodInvokeProxy,
  MethodInvokeProxy,
} from './metadata.js';
import {getInterceptProviderMetadata, Scope, ServiceTypeOf} from './decorator.js';
import {ResolveSession} from './resolve-session.js';
import {BindingNotFoundError} from './errors.js';
import {compileParamInjectInstruction} from './utils.js';

function constructorToFactory(constructor: Class) {
  return (...params: any[]) => Reflect.construct(constructor, params);
}

function validateParamInjectMetadata(metadata: ParamInjectionMetadata[], name: string, validatedSet: Set<ServiceId>) {
  metadata.forEach((v, idx) => {
    const {id, optional = false} = v;
    if (typeof id === 'undefined') {
      throw new TypeError('param inject id is undefined');
    }
    if (!validatedSet.has(id)) {
      if (optional) {
        return;
      }
      throw new BindingNotFoundError(id, `binding not found for parameters[${idx}] of "${name}"`);
    }
  });
}

export class AsyncMethodInvokeSession<
  T extends {},
  K extends keyof T,
  ContextIds extends any[] = [],
> extends ResolveSession {
  private result?: InvokeResult<T, K>;
  private readonly contextIds: ContextIds;

  constructor(
    bindingMap: Map<ServiceId, Binding<any>>,
    compiledInstructionMap: Map<ServiceId, Instruction[]>,
    globalCache: Map<any, any>,
    validatedBindings: Set<ServiceId>,
    readonly interceptProviderAndMetadata: [Instruction[], ServiceId[]][],
    private readonly proxyConstructInstructions: Instruction[],
    private readonly targetConstructor: Constructor,
    private readonly targetFunction: Function,
    ...contextIds: ContextIds
  ) {
    super(bindingMap, compiledInstructionMap, globalCache, validatedBindings);
    this.contextIds = contextIds;
  }

  async invokeTargetMethod(...ctx: ServiceTypeOf<ContextIds>): Promise<InvokeResult<T, K>> {
    for (let i = 0; i < ctx.length && i < this.contextIds.length; i++) {
      this.addTemporaryConstantBinding(this.contextIds[i], ctx[i]);
    }
    const performInvoke = (): Promise<InvokeResult<T, K>> => {
      const self = this.resolve(this.targetConstructor) as T;
      const proxyInstance = this.evalInstructions(this.proxyConstructInstructions) as MethodInvokeProxy;
      return proxyInstance.call(this.targetFunction, self);
    };
    return new Promise<InvokeResult<T, K>>((resolve, reject) => {
      const intercept = async (index: number): Promise<void> => {
        if (index === this.interceptProviderAndMetadata.length) {
          this.result = await performInvoke();
          return;
        }
        const [instructions, metadata] = this.interceptProviderAndMetadata[index];
        const instance = this.evalInstructions(instructions) as AsyncInterceptProvider<any>;

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
    private validatedSet: Set<ServiceId>,
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
      this.validatedSet,
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
    for (const interceptor of this.interceptors) {
      const pim = convertParamInjectionMetadata(ensureConstructorParamInjectMetadata(interceptor));
      validateParamInjectMetadata(pim, interceptor.name, validatedSet);
      const metadata = getInterceptProviderMetadata(interceptor);
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
      `${this.targetConstructor.name}.${String(this.targetMethod)}`,
      validatedSet,
    );
  }
}
