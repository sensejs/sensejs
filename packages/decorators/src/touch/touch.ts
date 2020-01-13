import _ from 'lodash';
import {Class, DecoratorBuilder} from '@sensejs/utility';
import {
  Constructor,
  Logger,
  FactoryProvider,
  ComponentScope,
  ComponentFactory,
  InjectLogger,
  ModuleClass,
  Inject,
  Optional,
  Component,
} from '@sensejs/core';
import {ensureMetadataOnPrototype} from '@sensejs/http-common';
import {buildPath, extractParams} from './utils';
import {AbstractTouchAdaptor, ITouchAdaptorBuilder} from './adaptor';
import {AxiosTouchBuilder} from './adaptor/axiosAdaptor';

const TouchSymbol = Symbol('sensejs#decorator#touch');
const TouchOptionsSymbol = Symbol('sensejs#decorator#touchOptions');
export const TouchBuilderSymbol = Symbol('sensejs#decorator#touchBuilder');

export interface ITouchClientOptions {
  adaptorBuilder?: ITouchAdaptorBuilder;
}

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

function createTouchClientFactory<T>(target: Class<T>): FactoryProvider<T> {
  @Component()
  class TouchFactory extends ComponentFactory<T> {
    private target: Constructor<T>;
    private adaptor: AbstractTouchAdaptor;

    constructor(
      @Inject(TouchBuilderSymbol)
      @Optional()
      private touchBuilder: ITouchAdaptorBuilder = new AxiosTouchBuilder(),
      @InjectLogger() @Optional() private logger: Logger,
    ) {
      super();
      this.target = target as Constructor<T>;
      this.adaptor = touchBuilder.build();

      this.implementTouchMethod();
    }

    build() {
      return new this.target();
    }

    implementTouchMethod() {
      const className = this.target.name;
      const prototypeMetadata = ensureMetadataOnPrototype<T>(this.target.prototype, {functionParamMetadata: new Map()});
      const {path: mainPath = '/', functionParamMetadata} = prototypeMetadata;

      for (const [name, {params, path: subPath, method}] of functionParamMetadata.entries()) {
        if (typeof subPath === 'undefined' || typeof method === 'undefined') {
          continue;
        }

        const pathCompiler = _.template(subPath, {interpolate: /{([\s\S]+?)}/g});

        // build request method
        this.target.prototype[name] = (async (...args: any[]) => {
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

            throw error;
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

export function createTouchModule(...constructors: Class[]): Constructor {
  checkTouchDecorated(...constructors);

  const factories: FactoryProvider<unknown>[] = constructors.map((target) => createTouchClientFactory(target));

  @ModuleClass({
    factories,
  })
  class TouchModule {}

  return TouchModule;
}
