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
  #result?: InvokeResult<T, K>;
  readonly #middlewaresAndMetadata: [Instruction[], ServiceId[]][];
  readonly #proxyConstructInstructions: Instruction[];
  readonly #targetConstructor: Constructor;
  readonly #targetFunction: Function;
  readonly #contextIds: ContextIds;

  constructor(
    bindingMap: Map<ServiceId, Binding<any>>,
    compiledInstructionMap: Map<ServiceId, Instruction[]>,
    globalCache: Map<any, any>,
    validatedBindings: Set<ServiceId>,
    readonly middlewaresAndMetadata: [Instruction[], ServiceId[]][],
    private readonly proxyConstructInstructions: Instruction[],
    private readonly targetConstructor: Constructor,
    private readonly targetFunction: Function,
    ...contextIds: ContextIds
  ) {
    super(bindingMap, compiledInstructionMap, globalCache, validatedBindings);
    this.#middlewaresAndMetadata = middlewaresAndMetadata;
    this.#proxyConstructInstructions = proxyConstructInstructions;
    this.#targetConstructor = targetConstructor;
    this.#targetFunction = targetFunction;
    this.#contextIds = contextIds;
  }

  async invokeTargetMethod(...ctx: ServiceTypeOf<ContextIds>): Promise<InvokeResult<T, K>> {
    for (let i = 0; i < ctx.length && i < this.#contextIds.length; i++) {
      this.addTemporaryConstantBinding(this.#contextIds[i], ctx[i]);
    }
    const performInvoke = (): Promise<InvokeResult<T, K>> => {
      const self = this.resolve(this.targetConstructor) as T;
      const proxyInstance = this.evalInstructions(this.proxyConstructInstructions) as MethodInvokeProxy;
      return proxyInstance.call(this.targetFunction, self);
    };
    return new Promise<InvokeResult<T, K>>((resolve, reject) => {
      const intercept = async (index: number): Promise<void> => {
        if (index === this.middlewaresAndMetadata.length) {
          this.#result = await performInvoke();
          return;
        }
        const [instructions, metadata] = this.middlewaresAndMetadata[index];
        const instance = this.evalInstructions(instructions) as CompatMiddleware<any>;
        const fn = (instance.handle ?? instance.intercept).bind(instance);

        return fn(async (...args: any[]) => {
          for (let i = 0; i < metadata.length; i++) {
            this.addTemporaryConstantBinding(metadata[i], args[i]);
          }

          await intercept(index + 1);
        });
      };
      intercept(0).then(() => resolve(this.#result!), reject);
    });
  }
}

export class MethodInvoker<T extends {}, K extends keyof T, ContextIds extends any[]> {
  readonly #proxyConstructInstructions: Instruction[];
  readonly #targetFunction: Function;
  readonly #interceptorProviderAndMetadata: [Instruction[], ServiceId[]][] = [];
  readonly #proxyConstructorInjectionMetadata;
  readonly #bindingMap;
  readonly #compiledInstructionMap;
  readonly #globalCache;
  readonly #validatedSet;
  readonly #targetConstructor;
  readonly #targetMethod;
  readonly middlewares;
  readonly #contextIds;

  constructor(
    bindingMap: Map<ServiceId, Binding<any>>,
    compiledInstructionMap: Map<ServiceId, Instruction[]>,
    globalCache: Map<ServiceId, any>,
    validatedSet: Set<ServiceId>,
    targetConstructor: Constructor<T>,
    targetMethod: K,
    middlewares: Constructor<CompatMiddleware<any>>[],
    ...contextIds: ContextIds
  ) {
    this.#bindingMap = bindingMap;
    this.#compiledInstructionMap = compiledInstructionMap;
    this.#globalCache = globalCache;
    this.#validatedSet = validatedSet;
    this.#targetConstructor = targetConstructor;
    this.#targetMethod = targetMethod;
    this.middlewares = middlewares;
    this.#contextIds = contextIds;
    const [proxy, fn] = ensureValidatedMethodInvokeProxy(targetConstructor, targetMethod);
    this.#proxyConstructorInjectionMetadata = convertParamInjectionMetadata(
      ensureConstructorParamInjectMetadata(proxy),
    );
    this.#validate();
    this.#proxyConstructInstructions = [
      {
        code: InstructionCode.BUILD,
        cacheScope: InjectScope.TRANSIENT,
        factory: constructorToFactory(proxy),
        paramCount: this.#proxyConstructorInjectionMetadata.length,
        serviceId: proxy,
      },
      ...compileParamInjectInstruction(this.#proxyConstructorInjectionMetadata, true),
    ];
    this.#targetFunction = fn;
  }

  createInvokeSession() {
    return new AsyncMethodInvokeSession(
      this.#bindingMap,
      this.#compiledInstructionMap,
      this.#globalCache,
      this.#validatedSet,
      this.#interceptorProviderAndMetadata,
      this.#proxyConstructInstructions,
      this.#targetConstructor,
      this.#targetFunction,
      ...this.#contextIds,
    );
  }

  #validate() {
    const validatedSet = new Set(new Map(this.#bindingMap).keys());
    this.#contextIds.forEach((id) => validatedSet.add(id));
    for (const interceptor of this.middlewares) {
      const pim = convertParamInjectionMetadata(ensureConstructorParamInjectMetadata(interceptor));
      validateParamInjectMetadata(pim, interceptor.name, validatedSet);
      const metadata = getMiddlewareMetadata(interceptor);
      metadata.forEach((x) => validatedSet.add(x));
      this.#interceptorProviderAndMetadata.push([
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
      this.#proxyConstructorInjectionMetadata,
      `${this.#targetConstructor.name}.${String(this.#targetMethod)}`,
      validatedSet,
    );
  }
}
