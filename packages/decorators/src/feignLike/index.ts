import _ from 'lodash';
import {Class, DecoratorBuilder, ClassDecorator} from '@sensejs/utility';
import {Constructor, Logger} from '@sensejs/core';
import {ensureMetadataOnPrototype} from '@sensejs/http-common';
import {buildPath, extractParams} from './utils';
import {AbstractRequestClass} from './adaptor';
import {DefaultAxiosAdaptorFactory} from './adaptor/axiosAdaptor';

export interface IAdaptorFactory<TOption = any> {
  (options: TOption): AbstractRequestClass;
}

export interface IFeignClientOptions {
  adaptorOptions?: any;
  adaptorFactory?: IAdaptorFactory;
  loggerFactory?: (...args: any) => Logger;
  errorHandler?: <T = any>(error: Error) => T | never;
}

const LazyDecorateSymbol = Symbol('sensejs#decorator#lazy');

function FeignDecorator(options: IFeignClientOptions = {}) {
  return <T extends object>(target: Class<T>) => {
    const {adaptorFactory = DefaultAxiosAdaptorFactory, loggerFactory, errorHandler} = options;
    const className = target.prototype.constructor.name;

    const prototypeMetadata = ensureMetadataOnPrototype<T>(target.prototype, {functionParamMetadata: new Map()});
    const {path: mainPath = '/', functionParamMetadata} = prototypeMetadata;

    for (const [name, {params, path: subPath, method}] of functionParamMetadata.entries()) {
      if (typeof subPath === 'undefined' || typeof method === 'undefined') {
        continue;
      }

      const pathCompiler = _.template(subPath, {interpolate: /{([\s\S]+?)}/g});
      const adaptor = adaptorFactory(options.adaptorOptions);

      // build request method
      target.prototype[name] = async function(this: Class<T>, ...args: any[]) {
        const logger = loggerFactory?.(this);
        const paramsObject = extractParams(params, args);
        const {query, body, headers, param} = paramsObject;
        const compiledSubpath = pathCompiler(param);
        const path = buildPath(mainPath, compiledSubpath);

        logger?.info(
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
          logger?.info(
            'Request <class: %s> <classMethod: %s> <path: %s> <method: %s> <args: %j>',
            className,
            name,
            path,
            method,
            args,
          );
          const response = await adaptor[method](path, {query, body, headers});
          logger?.info(
            'Request <class: %s> <classMethod: %s> <path: %s> <method: %s> <response: %j>',
            className,
            name,
            path,
            method,
            response,
          );

          return response;
        } catch (error) {
          logger?.error(
            'Request <class: %s> <classMethod: %s> <path: %s> <method: %s> error: ',
            className,
            name,
            path,
            method,
            error.message ?? error,
          );

          if (errorHandler) {
            return errorHandler(error);
          }

          throw error;
        }
      } as any;
    }
  };
}

export function FeignClient(options: IFeignClientOptions = {}) {
  return new DecoratorBuilder('FeignClient', true)
    .whenApplyToConstructor((<T extends {[LazyDecorateSymbol]: boolean}>(target: Constructor<T>) => {
      // lazy decorate
      return new Proxy(target, {
        construct(t, args) {
          if (!t.prototype[LazyDecorateSymbol]) {
            FeignDecorator(options)(target);
            t.prototype[LazyDecorateSymbol] = true;
          }
          return new t(...args);
        },
      });
    }) as ClassDecorator)
    .build();
}
