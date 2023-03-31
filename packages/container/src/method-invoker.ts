import {Binding, Class, Constructor, InjectScope, InvokeResult, ParamInjectionMetadata, ServiceId} from './types.js';
import {Instruction, InstructionCode} from './instructions.js';
import {
  convertParamInjectionMetadata,
  ensureConstructorParamInjectMetadata,
  ensureValidatedMethodInvokeProxy,
  MethodInvokeProxy,
} from './metadata.js';
import {Scope} from './decorator.js';
import {getMiddlewareMetadata, Middleware, ServiceTypeOf} from './middleware.js';
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
  readonly #contextIds: ContextIds;
  readonly #performInvoke;
  readonly #result: Promise<InvokeResult<T, K>>;


  constructor(
    bindingMap: Map<ServiceId, Binding<any>>,
    compiledInstructionMap: Map<ServiceId, Instruction[]>,
    globalCache: Map<any, any>,
    validatedBindings: Set<ServiceId>,
    metadataOfMiddlewares: [Instruction[], ServiceId[]][],
    proxyConstructInstructions: Instruction[],
    targetConstructor: Constructor,
    targetFunction: Function,
    ...contextIds: ContextIds
  ) {
    super(bindingMap, compiledInstructionMap, globalCache, validatedBindings);
    this.#contextIds = contextIds;
    let resolveCallback: (value: InvokeResult<T, K>) => void;
    let rejectCallback: (reason?: any) => void;
    this.#result = new Promise<InvokeResult<T, K>>((resolve, reject) => {
      resolveCallback = resolve;
      rejectCallback = reject;
    });

    let func = async (): Promise<void> => {
      const self = this.resolve(targetConstructor) as T;
      const proxyInstance = this.evalInstructions(proxyConstructInstructions) as MethodInvokeProxy;
      const promise = Promise.resolve<InvokeResult<T, K>>(proxyInstance.call(targetFunction, self));
      promise.then(resolveCallback, rejectCallback);
      await promise;
    };

    metadataOfMiddlewares = metadataOfMiddlewares.slice();

    for (;;) {
      const mam = metadataOfMiddlewares.pop();
      if (typeof mam === 'undefined') {
        break;
      }
      const [instructions, metadata] = mam;
      const next = func;
      func = async (): Promise<void> => {
        const instance = this.evalInstructions(instructions) as Middleware<any>;

        return instance.handle((...args: any[]) => {
          for (let i = 0; i < metadata.length; i++) {
            this.addTemporaryConstantBinding(metadata[i], args[i]);
          }

          return next();
        });
      };
    }
    this.#performInvoke = func;
  }

  async invokeTargetMethod(...ctx: ServiceTypeOf<ContextIds>): Promise<InvokeResult<T, K>> {
    for (let i = 0; i < ctx.length && i < this.#contextIds.length; i++) {
      this.addTemporaryConstantBinding(this.#contextIds[i], ctx[i]);
    }
    return new Promise<InvokeResult<T, K>>((resolve, reject) => {
      this.#performInvoke()
        .then(() => this.#result.then(resolve))
        .catch(reject);
    });
  }
}

export class MethodInvoker<T extends {}, K extends keyof T, ContextIds extends any[]> {
  readonly #proxyConstructInstructions: Instruction[];
  readonly #targetFunction: Function;
  readonly #interceptorProviderAndMetadata: [Instruction[], ServiceId[]][] = [];
  readonly #proxyConstructorInjectionMetadata;
  readonly #contextIds;
  readonly #bindingMap;
  readonly #compiledInstructionMap;
  readonly #globalCache;
  readonly #validatedSet;
  readonly #targetConstructor;
  readonly #targetMethod;
  readonly middlewares;

  constructor(
    bindingMap: Map<ServiceId, Binding<any>>,
    compiledInstructionMap: Map<ServiceId, Instruction[]>,
    globalCache: Map<ServiceId, any>,
    validatedSet: Set<ServiceId>,
    targetConstructor: Constructor<T>,
    targetMethod: K,
    middlewares: Constructor<Middleware<any>>[],
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
    for (const middleware of this.middlewares) {
      const pim = convertParamInjectionMetadata(ensureConstructorParamInjectMetadata(middleware));
      validateParamInjectMetadata(pim, middleware.name, validatedSet);
      const metadata = getMiddlewareMetadata(middleware);
      metadata.forEach((x) => validatedSet.add(x));
      this.#interceptorProviderAndMetadata.push([
        [
          {
            code: InstructionCode.BUILD,
            paramCount: pim.length,
            factory: (...args) => Reflect.construct(middleware, args),
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
