import {Container, inject} from 'inversify';
import * as http from 'http';
import {getHttpControllerMetadata} from './http-decorators';
import {promisify} from 'util';
import {KoaHttpApplicationBuilder} from './http-koa-integration';
import {HttpInterceptor, HttpAdaptor} from './http-abstract';
import {Constructor, Module, ModuleConstructor, ModuleOption, ServiceIdentifier} from '@sensejs/core';

export interface HttpConfig {
  listenAddress: string;
  listenPort: number;
}

export enum HttpConfigType {
  static,
  injected,
}

const defaultHttpConfig = {
  listenAddress: '0.0.0.0',
  listenPort: 3000,
};

export interface BaseHttpModuleOption extends ModuleOption {
  httpAdaptorFactory?: (container: Container) => HttpAdaptor;
  inspectors?: Constructor<HttpInterceptor>[];
  serverIdentifier?: ServiceIdentifier<unknown>;
}

export interface StaticHttpModuleOption extends BaseHttpModuleOption {
  type: HttpConfigType.static;
  staticHttpConfig: HttpConfig;
}

export interface DynamicHttpModuleOption extends BaseHttpModuleOption {
  type: HttpConfigType.injected;
  injectHttpConfig: ServiceIdentifier<unknown>;
}

export type HttpModuleOption = StaticHttpModuleOption | DynamicHttpModuleOption;

/**
 *
 * @param option
 * @constructor
 */
export function HttpModule(
  option: HttpModuleOption = {
    type: HttpConfigType.static,
    staticHttpConfig: defaultHttpConfig,
  },
): ModuleConstructor {
  const httpAdaptorFactory =
    option.httpAdaptorFactory || ((container: Container) => new KoaHttpApplicationBuilder(container));
  const componentList = option.components || [];

  class HttpModule extends Module(option) {
    private httpServer?: http.Server;
    private container: Container;

    constructor(@inject(Container) container: Container) {
      super();
      this.container = container;
    }

    async onCreate() {
      const httpAdaptor = httpAdaptorFactory(this.container);
      const httpConfig =
        option.type === HttpConfigType.static
          ? option.staticHttpConfig
          : (this.container.get(option.injectHttpConfig) as HttpConfig);

      for (const inspector of option.inspectors || []) {
        httpAdaptor.addGlobalInspector(inspector);
      }
      componentList.forEach((component) => {
        const httpControllerMetadata = getHttpControllerMetadata(component);
        if (httpControllerMetadata) {
          httpAdaptor.addControllerMapping(httpControllerMetadata);
        }
        // TODO: Implement other HTTP stuffs, like middleware and interceptor
      });

      this.httpServer = await this.createHttpServer(httpConfig, httpAdaptor);

      if (option.serverIdentifier) {
        this.container.bind(option.serverIdentifier).toConstantValue(this.httpServer);
      }
    }

    async onDestroy() {
      return promisify((done: (e?: Error) => void) => {
        if (!this.httpServer) {
          return done();
        }
        return this.httpServer.close(done);
      })();
    }

    private createHttpServer(httpConfig: HttpConfig, httpAdaptor: HttpAdaptor) {
      return new Promise<http.Server>((resolve, reject) => {
        const httpServer = http.createServer(httpAdaptor.build());
        httpServer.once('error', reject);
        httpServer.listen(httpConfig.listenPort, httpConfig.listenAddress, () => {
          httpServer.removeListener('error', reject);
          resolve(httpServer);
        });
      });
    }
  }
  return HttpModule;
}
