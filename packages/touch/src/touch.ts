import _ from 'lodash';
import {Class, DecoratorBuilder} from '@sensejs/utility';
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
} from '@sensejs/core';
import {ensureMetadataOnPrototype} from '@sensejs/http-common';
import {buildPath, extractParams} from './utils';
import {AbstractTouchAdaptor, ITouchAdaptorBuilder} from './adaptor/interface';
import {AxiosTouchAdaptorBuilder} from './adaptor/axiosAdaptor';
import {ITouchClientOptions, ITouchModuleOptions} from './interface';
import {DEFAULT_RETRY_COUNT} from './constants';

const TouchSymbol = Symbol('sensejs#decorator#touch');
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

        const pathCompiler = _.template(subPath, {interpolate: /{([\s\S]+?)}/g});

        // build request method
        Implementation.prototype[name] = (async (...args: any[]) => {
          const paramsObject = extractParams(params, args);
          const {query, body, headers, param} = paramsObject;
          const compiledSubpath = pathCompiler(param);
          const path = buildPath(mainPath, compiledSubpath);

          this.logger?.info(
            'Request <class: %s> <classMethod: %s> <path: %s> <method: %s> <query: %j> <body: %j> <param: %j> <headers: %j>',
            className,
            name,
            path,
            method,
            query,
            body,
            param,
            headers,
          );

          let counter = 1;
          while (true) {
            try {
              this.logger?.info(
                'Request <class: %s> <classMethod: %s> <path: %s> <method: %s> <args: %j>',
                className,
                name,
                path,
                method,
                args,
              );
              const response = await this.adaptor[method](path, {query, body, headers});
              this.logger?.info(
                'Request <class: %s> <classMethod: %s> <path: %s> <method: %s> <response: %j>',
                className,
                name,
                path,
                method,
                response,
              );

              return response;
            } catch (error) {
              this.logger?.error(
                'Request <class: %s> <classMethod: %s> <path: %s> <method: %s> error: ',
                className,
                name,
                path,
                method,
                error.message ?? error,
              );

              counter++;
              if (counter > retry) {
                throw error;
              }
            }
          }
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
  const {injectOptionFrom, ...globalClientOptions} = options;
  const clientOptions: ITouchClientOptions = Reflect.getMetadata(TouchOptionsSymbol, client);

  const injectOptionsSymbol = Symbol('sensejs#touch#options');
  const touchFactory = createTouchClientFactory(client, injectOptionsSymbol);
  const optionsFactory = provideOptionInjector(
    globalClientOptions,
    clientOptions.injectOptionFrom || injectOptionFrom,
    (globalOptions, injectedOptions) => Object.assign({}, globalOptions, clientOptions, injectedOptions),
    injectOptionsSymbol,
  );

  @ModuleClass({
    factories: [touchFactory, optionsFactory],
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
