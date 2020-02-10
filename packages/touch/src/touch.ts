import _ from 'lodash';
import {Class, DecoratorBuilder, InstanceMethodDecorator} from '@sensejs/utility';
import {Container} from 'inversify';
import {
  Constructor,
  Logger,
  FactoryProvider,
  ComponentScope,
  Component,
  ComponentFactory,
  Inject,
  InjectLogger,
  ModuleClass,
  Optional,
  provideOptionInjector,
  ServiceIdentifier,
  composeRequestInterceptor,
  RequestInterceptor,
} from '@sensejs/core';
import {ensureMetadataOnPrototype, ensureMetadataOnMethod} from '@sensejs/http-common';
import {buildPath, extractParams} from './utils';
import {AbstractTouchAdaptor, ITouchAdaptorBuilder} from './adaptor/interface';
import {AxiosTouchAdaptorBuilder} from './adaptor/axiosAdaptor';
import {ITouchClientOptions, ITouchModuleOptions} from './interface';
import {DEFAULT_RETRY_COUNT} from './constants';
import {TouchRequestContext} from './interceptor';

const TouchSymbol = Symbol('sensejs#decorator#touch');
const TouchInterceptorSymbol = Symbol('sensejs#decorator#touchInterceptor');
const TouchOptionsSymbol = Symbol('sensejs#decorator#touchOptions');
export const TouchBuilderSymbol = Symbol('sensejs#decorator#touchBuilder');

export function TouchClient(options: ITouchClientOptions = {}) {
  return new DecoratorBuilder('TouchClient')
    .whenApplyToConstructor((target: Class) => {
      Component()(target as Constructor);
      Reflect.defineMetadata(TouchSymbol, true, target);
      Reflect.defineMetadata(TouchOptionsSymbol, options, target);
    })
    .build<ClassDecorator>();
}

// TODO: add `@Interceptor` decorator
export function TouchInterceptor(interceptors: Class<RequestInterceptor>[]) {
  return new DecoratorBuilder('TouchInterceptor')
    .whenApplyToInstanceMethod((target: object, methodName: PropertyKey) => {
      let interceptorMetadata = getTouchInterceptorMetadata(target);
      if (!interceptorMetadata) {
        interceptorMetadata = {};
        Reflect.defineMetadata(TouchInterceptorSymbol, interceptorMetadata, target);
      }
      interceptorMetadata[methodName] = interceptors;
    })
    .build<InstanceMethodDecorator>();
}

function getTouchInterceptorMetadata(target: any) {
  return Reflect.getMetadata(TouchInterceptorSymbol, target);
}

function getTouchInterceptor(target: any, propertyName?: PropertyKey): Class<RequestInterceptor>[] {
  const interceptorMetadata: {[propertyName: string]: Class<RequestInterceptor>[]} =
    getTouchInterceptorMetadata(target) || {};
  if (typeof propertyName === 'undefined') {
    return Object.keys(interceptorMetadata).reduce((prev, key) => {
      prev = prev.concat(interceptorMetadata[key] || []);
      return prev;
    }, [] as Class<RequestInterceptor>[]);
  }

  return interceptorMetadata[propertyName as string] || [];
}

function checkTouchDecorated(...constructors: Class[]) {
  for (const ctor of constructors) {
    if (!Reflect.getMetadata(TouchSymbol, ctor)) {
      throw new Error('target should be decorated with @TouchClient');
    }
  }
}

function createTouchClientFactory<T extends {}>(
  target: Class<T>,
  injectOptionsSymbol: ServiceIdentifier,
): FactoryProvider<T> {
  const Implementation = class TouchClient extends (target as Constructor<any>) {} as Constructor<T>;

  @Component()
  class TouchFactory extends ComponentFactory<T> {
    private target: Constructor<T>;
    private adaptor: AbstractTouchAdaptor;

    private options: ITouchClientOptions = {};

    constructor(
      @Inject(TouchBuilderSymbol)
      @Optional()
      private touchBuilder: ITouchAdaptorBuilder = new AxiosTouchAdaptorBuilder(),
      @InjectLogger() @Optional() private logger: Logger,
      @Inject(Container) private container: Container,
    ) {
      super();
      this.options = container.get(injectOptionsSymbol);
      this.target = target as Constructor<T>;
      this.adaptor = touchBuilder.build(this.options);

      this.implementTouchMethod();
    }

    build(): T {
      return new Implementation();
    }

    implementTouchMethod() {
      const {retry = DEFAULT_RETRY_COUNT} = this.options;
      const className = this.target.name;
      const prototypeMetadata = ensureMetadataOnPrototype<T>(this.target.prototype, {functionParamMetadata: new Map()});
      const {path: mainPath = '/', functionParamMetadata} = prototypeMetadata;

      for (const [name, {params, path: subPath, method}] of functionParamMetadata.entries()) {
        if (typeof subPath === 'undefined' || typeof method === 'undefined') {
          continue;
        }

        const allInterceptors = [
          ...(this.options.interceptors || []),
          ...getTouchInterceptor(this.target.prototype, name),
        ];
        const pathCompiler = _.template(subPath, {interpolate: /{([\s\S]+?)}/g});
        const composedInterceptor = composeRequestInterceptor(this.container, allInterceptors);

        // build request method
        Implementation.prototype[name] = (async (...args: any[]) => {
          // TODO: remove container
          const container = this.container.createChild();

          const paramsObject = extractParams(params, args);
          const context = new TouchRequestContext(container, {
            ...paramsObject,
            className,
            method,
            methodName: name as string,
            path: subPath,
            args,
          });

          const interceptor = container.get(composedInterceptor);
          await interceptor.intercept(context, async () => {
            const compiledSubpath = pathCompiler(paramsObject.param);
            const path = buildPath(mainPath, compiledSubpath);
            context.path = path;

            while (true) {
              try {
                return (context.response = await this.adaptor[method](path, paramsObject));
              } catch (error) {
                context.retryCount++;
                if (context.retryCount >= retry) {
                  throw error;
                }
              }
            }
          });

          return context.response;
        }) as any;
      }
    }
  }

  return {
    provide: target,
    scope: ComponentScope.TRANSIENT,
    factory: TouchFactory,
  };
}

function createSingleTouchModule(client: Class, options: ITouchModuleOptions): Constructor {
  checkTouchDecorated(client);
  const {injectOptionFrom, interceptors: globalInterceptor = [], ...globalClientOptions} = options;
  const {interceptors: clientInterceptors = [], ...clientOptions}: ITouchClientOptions =
    Reflect.getMetadata(TouchOptionsSymbol, client) || {};

  const interceptors = [...globalInterceptor, ...clientInterceptors];

  const injectOptionsSymbol = Symbol('sensejs#touch#options');
  const touchFactory = createTouchClientFactory(client, injectOptionsSymbol);
  const optionsFactory = provideOptionInjector(
    globalClientOptions,
    clientOptions.injectOptionFrom || injectOptionFrom,
    (globalOptions, injectedOptions) => Object.assign({interceptors}, globalOptions, clientOptions, injectedOptions),
    injectOptionsSymbol,
  );

  const allInterceptors = [...interceptors, ...getTouchInterceptor(client.prototype)];

  @ModuleClass({
    factories: [touchFactory, optionsFactory],
    components: allInterceptors as Constructor<RequestInterceptor>[],
  })
  class TouchModule {}
  return TouchModule;
}

function createMultiTouchModule(clients: Class[], options: ITouchModuleOptions): Constructor {
  const touchModules = clients.map((client) => createSingleTouchModule(client, options));

  @ModuleClass({
    requires: touchModules,
  })
  class MultiTouchModule {}
  return MultiTouchModule;
}

export function createTouchModule(options: ITouchModuleOptions) {
  const {clients} = options;
  if (Array.isArray(clients)) {
    return createMultiTouchModule(clients, options);
  }

  return createSingleTouchModule(clients, options);
}
