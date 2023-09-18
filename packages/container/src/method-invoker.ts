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

class AsyncMethodInvokeSession<T extends {}, K extends keyof T, ContextIds extends any[] = []> extends ResolveSession {
  readonly #resolveCallback: (value: InvokeResult<T, K>) => void;

  get resolveCallback() {
    return this.#resolveCallback;
  }
  constructor(
    bindingMap: Map<ServiceId, Binding<any>>,
    compiledInstructionMap: Map<ServiceId, Instruction[]>,
    globalCache: Map<any, any>,
    contextIds: ContextIds,
    context: ServiceTypeOf<ContextIds>,
    resolveCallback: (value: InvokeResult<T, K>) => void,
  ) {
    super(bindingMap, compiledInstructionMap, globalCache);
    this.#resolveCallback = resolveCallback;
    contextIds.forEach((ctxId, idx) => {
      this.addTemporaryConstantBinding(ctxId, context[idx]);
    });
  }

  public evalInstructions(instruction: Instruction[] = []): any {
    return super.evalInstructions(instruction);
  }
}

function validateAndBuildMiddlewareMetadata<T extends {}, K extends keyof T, ContextIds extends any[]>(
  bindingMap: Map<ServiceId, Binding<any>>,
  contextIds: ContextIds,
  middlewares: Constructor<Middleware<any>>[],
  proxyConstructorInjectionMetadata: ParamInjectionMetadata[],
  targetConstructor: Class,
  targetMethod: K,
): [Instruction[], ServiceId[]][] {
  const metadataOfMiddlewares: [Instruction[], ServiceId[]][] = [];
  const validatedSet = new Set(new Map(bindingMap).keys());
  contextIds.forEach((id) => validatedSet.add(id));
  for (const middleware of middlewares) {
    const pim = convertParamInjectionMetadata(ensureConstructorParamInjectMetadata(middleware));
    validateParamInjectMetadata(pim, middleware.name, validatedSet);
    const metadata = getMiddlewareMetadata(middleware);
    metadata.forEach((x) => validatedSet.add(x));
    metadataOfMiddlewares.push([
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
    proxyConstructorInjectionMetadata,
    `${targetConstructor.name}.${String(targetMethod)}`,
    validatedSet,
  );
  return metadataOfMiddlewares;
}

function buildInvoker<T extends {}, K extends keyof T, ContextIds extends any[]>(
  bindingMap: Map<ServiceId, Binding<any>>,
  compiledInstructionMap: Map<ServiceId, Instruction[]>,
  globalCache: Map<any, any>,
  middlewares: Constructor<Middleware>[],
  targetConstructor: Constructor<T>,
  targetMethod: K,
  contextIds: ContextIds,
) {
  const [proxy, fn] = ensureValidatedMethodInvokeProxy(targetConstructor, targetMethod);
  const proxyConstructorInjectionMetadata = convertParamInjectionMetadata(ensureConstructorParamInjectMetadata(proxy));
  const metadataOfMiddlewares = validateAndBuildMiddlewareMetadata<T, K, ContextIds>(
    bindingMap,
    contextIds,
    middlewares,
    proxyConstructorInjectionMetadata,
    targetConstructor,
    targetMethod,
  );
  const proxyConstructInstructions: Instruction[] = [
    {
      code: InstructionCode.BUILD,
      cacheScope: InjectScope.TRANSIENT,
      factory: constructorToFactory(proxy),
      paramCount: proxyConstructorInjectionMetadata.length,
      serviceId: proxy,
    },
    ...compileParamInjectInstruction(proxyConstructorInjectionMetadata, true),
  ];

  let func = async (session: AsyncMethodInvokeSession<T, K, ContextIds>): Promise<any> => {
    const self = session.resolve(targetConstructor) as T;
    const proxyInstance = session.evalInstructions(proxyConstructInstructions) as MethodInvokeProxy;
    const promise = Promise.resolve<InvokeResult<T, K>>(proxyInstance.call(fn, self));
    session.resolveCallback(await promise);
  };

  for (;;) {
    const mam = metadataOfMiddlewares.pop();
    if (typeof mam === 'undefined') {
      break;
    }
    const [instructions, metadata] = mam;
    const next = func;
    func = (session: AsyncMethodInvokeSession<T, K, ContextIds>): Promise<void> => {
      const instance = session.evalInstructions(instructions) as Middleware<any>;

      return instance.handle((...args: any[]) => {
        for (let i = 0; i < metadata.length; i++) {
          session.addTemporaryConstantBinding(metadata[i], args[i]);
        }

        return next(session);
      });
    };
  }

  return (...ctx: ServiceTypeOf<ContextIds>) => {
    return new Promise<InvokeResult<T, K>>((resolve, reject) => {
      const promise = func(
        new AsyncMethodInvokeSession<T, K, ContextIds>(
          bindingMap,
          compiledInstructionMap,
          globalCache,
          contextIds,
          ctx,
          (value) => {
            promise.then(() => resolve(value));
          },
        ),
      ).catch(reject);
    });
  };
}

export class MethodInvoker<T extends {}, K extends keyof T, ContextIds extends any[]> {
  readonly #invokeFunction: (...ctx: ServiceTypeOf<ContextIds>) => Promise<InvokeResult<T, K>>;

  constructor(
    bindingMap: Map<ServiceId, Binding<any>>,
    compiledInstructionMap: Map<ServiceId, Instruction[]>,
    globalCache: Map<ServiceId, any>,
    targetConstructor: Constructor<T>,
    targetMethod: K,
    middlewares: Constructor<Middleware<any>>[],
    ...contextIds: ContextIds
  ) {
    this.#invokeFunction = buildInvoker(
      bindingMap,
      compiledInstructionMap,
      globalCache,
      middlewares,
      targetConstructor,
      targetMethod,
      contextIds,
    );
  }

  invoke(...ctx: ServiceTypeOf<ContextIds>) {
    return this.#invokeFunction(...ctx);
  }
}
