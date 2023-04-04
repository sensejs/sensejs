import {
  Binding,
  Class,
  CompatMiddleware,
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
import {getMiddlewareMetadata, Scope, ServiceTypeOf} from './decorator.js';
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
  private readonly contextIds: ContextIds;
  private readonly performInvoke;

  constructor(
    bindingMap: Map<ServiceId, Binding<any>>,
    compiledInstructionMap: Map<ServiceId, Instruction[]>,
    globalCache: Map<any, any>,
    validatedBindings: Set<ServiceId>,
    middlewareAndMetadata: [Instruction[], ServiceId[]][],
    proxyConstructInstructions: Instruction[],
    targetConstructor: Constructor,
    targetFunction: Function,
    ...contextIds: ContextIds
  ) {
    super(bindingMap, compiledInstructionMap, globalCache, validatedBindings);
    this.contextIds = contextIds;

    // let idx = this.interceptProviderAndMetadata.length - 1;

    let func = async (): Promise<InvokeResult<T, K>> => {
      const self = this.resolve(targetConstructor) as T;
      const proxyInstance = this.evalInstructions(proxyConstructInstructions) as MethodInvokeProxy;
      return proxyInstance.call(targetFunction, self);
    };

    for (;;) {
      const mam = middlewareAndMetadata.pop();
      if (typeof mam === 'undefined') break;
      const [instructions, metadata] = mam;
      const next = func;
      func = async (): Promise<InvokeResult<T, K>> => {
        const instance = this.evalInstructions(instructions) as CompatMiddleware<any>;
        const fn = (instance.handle ?? instance.intercept).bind(instance);

        return new Promise<InvokeResult<T, K>>((resolve, reject) =>
          fn(async (...args: any[]) => {
            for (let i = 0; i < metadata.length; i++) {
              this.addTemporaryConstantBinding(metadata[i], args[i]);
            }

            next().then(resolve, reject);
          }),
        );
      };
    }
    this.performInvoke = func;
  }

  async invokeTargetMethod(...ctx: ServiceTypeOf<ContextIds>): Promise<InvokeResult<T, K>> {
    for (let i = 0; i < ctx.length && i < this.contextIds.length; i++) {
      this.addTemporaryConstantBinding(this.contextIds[i], ctx[i]);
    }
    return this.performInvoke();
  }
}

export class MethodInvoker<T extends {}, K extends keyof T, ContextIds extends any[]> {
  private readonly proxyConstructInstructions: Instruction[];
  private readonly targetFunction: Function;
  private readonly interceptorProviderAndMetadata: [Instruction[], ServiceId[]][] = [];
  private readonly proxyConstructorInjectionMetadata;
  private readonly contextIds;

  constructor(
    readonly bindingMap: Map<ServiceId, Binding<any>>,
    readonly compiledInstructionMap: Map<ServiceId, Instruction[]>,
    private globalCache: Map<ServiceId, any>,
    private validatedSet: Set<ServiceId>,
    private targetConstructor: Constructor<T>,
    private targetMethod: K,
    private interceptors: Constructor<CompatMiddleware<any>>[],
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
      const metadata = getMiddlewareMetadata(interceptor);
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
