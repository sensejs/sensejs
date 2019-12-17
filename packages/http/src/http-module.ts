import {Container, ContainerModule} from 'inversify';
import * as http from 'http';
import {getHttpControllerMetadata} from './http-decorators';
import {promisify} from 'util';
import {KoaHttpApplicationBuilder} from './http-koa-integration';
import {HttpInterceptor, HttpAdaptor, HttpApplicationOption} from './http-abstract';
import {
  Constructor,
  Module,
  ModuleConstructor,
  ModuleOption,
  ServiceIdentifier,
  provideOptionInjector,
  Inject,
} from '@sensejs/core';

export interface HttpOption extends HttpApplicationOption {
  listenAddress: string;
  listenPort: number;
  trustProxy?: boolean;
}

export enum HttpConfigType {
  static,
  injected,
}

const defaultHttpConfig = {
  listenAddress: '0.0.0.0',
  listenPort: 3000,
};

export interface HttpModuleOption extends ModuleOption {
  httpAdaptorFactory?: () => HttpAdaptor;
  globalInterceptors?: Constructor<HttpInterceptor>[];
  serverIdentifier?: ServiceIdentifier<unknown>;
  httpOption?: Partial<HttpOption>;
  injectOptionFrom?: ServiceIdentifier<Partial<HttpOption>>;
}

function getHttpAdaptor() {}

/**
 *
 * @param option
 * @constructor
 */
export function HttpModule(
  option: HttpModuleOption = {
    httpOption: defaultHttpConfig,
  },
): ModuleConstructor {
  const httpAdaptorFactory = option.httpAdaptorFactory || (() => new KoaHttpApplicationBuilder());
  const componentList = option.components || [];
  const optionProvider = provideOptionInjector<HttpOption>(
    option.httpOption,
    option.injectOptionFrom,
    (defaultValue, injectedValue) => {
      const {listenAddress, listenPort, ...rest} = Object.assign({}, defaultValue, injectedValue);
      if (typeof listenAddress !== 'string' || typeof listenPort !== 'number') {
        throw new Error('invalid http config');
      }
      return {listenAddress, listenPort, ...rest};
    },
  );

  class HttpModule extends Module({requires: [Module(option)], factories: [optionProvider]}) {
    private httpServer?: http.Server;
    private interceptorModule?: ContainerModule;

    constructor(
      @Inject(Container) private container: Container,
      @Inject(optionProvider.provide) private httpOption: HttpOption,
    ) {
      super();
    }

    async onCreate() {
      await super.onCreate();
      const httpAdaptor = httpAdaptorFactory();

      for (const inspector of option.globalInterceptors || []) {
        httpAdaptor.addGlobalInspector(inspector);
      }
      componentList.forEach((component) => {
        const httpControllerMetadata = getHttpControllerMetadata(component);
        if (httpControllerMetadata) {
          httpAdaptor.addControllerWithMetadata(httpControllerMetadata);
        }
      });
      const allInterceptors = httpAdaptor.getAllInterceptors();
      this.interceptorModule = new ContainerModule((bind) => {
        allInterceptors.forEach((interceptor) => {
          bind(interceptor).toSelf();
        });
      });
      this.container.load(this.interceptorModule);

      this.httpServer = await this.createHttpServer(this.httpOption, httpAdaptor);

      if (option.serverIdentifier) {
        this.container.bind(option.serverIdentifier).toConstantValue(this.httpServer);
      }
    }

    async onDestroy() {
      await promisify((done: (e?: Error) => void) => {
        if (!this.httpServer) {
          return done();
        }
        return this.httpServer.close(done);
      })();
      if (this.interceptorModule) {
        this.container.unload(this.interceptorModule);
      }
      await super.onDestroy();
    }

    private createHttpServer(httpOption: HttpOption, httpAdaptor: HttpAdaptor) {
      return new Promise<http.Server>((resolve, reject) => {
        const httpServer = http.createServer(httpAdaptor.build(httpOption, this.container));
        httpServer.once('error', reject);
        httpServer.listen(httpOption.listenPort, httpOption.listenAddress, () => {
          httpServer.removeListener('error', reject);
          resolve(httpServer);
        });
      });
    }
  }

  return Module({requires: [HttpModule]});
}
