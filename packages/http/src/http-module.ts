import {Container, ContainerModule} from 'inversify';
import * as http from 'http';
import {getHttpControllerMetadata} from './http-decorators';
import {promisify} from 'util';
import {KoaHttpApplicationBuilder} from './http-koa-integration';
import {HttpAdaptor, HttpApplicationOption, HttpInterceptor} from './http-abstract';
import {
  Constructor,
  createModule,
  Deprecated,
  Inject,
  ModuleClass,
  ModuleConstructor,
  ModuleOption,
  OnModuleCreate,
  OnModuleDestroy,
  provideOptionInjector,
  ServiceIdentifier,
  createLegacyModule,
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
  serverIdentifier?: ServiceIdentifier;
  httpOption?: Partial<HttpOption>;
  injectOptionFrom?: ServiceIdentifier<Partial<HttpOption>>;
}

/**
 *
 * @param option
 * @constructor
 */
export function HttpModuleClass(
  option: HttpModuleOption = {
    httpOption: defaultHttpConfig,
  },
) {
  const httpAdaptorFactory = option.httpAdaptorFactory || (
    () => new KoaHttpApplicationBuilder()
  );
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

  @ModuleClass({
    requires: [createModule(option)],
    factories: [optionProvider],
  })
  class HttpModule {
    private httpServer?: http.Server;
    private interceptorModule?: ContainerModule;

    constructor(
      @Inject(Container) private container: Container,
      @Inject(optionProvider.provide) private httpOption: HttpOption,
    ) {}

    @OnModuleCreate()
    async onCreate() {
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

    @OnModuleDestroy()
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

  return ModuleClass({requires: [HttpModule]});
}

export const HttpModule = createLegacyModule(
  HttpModuleClass,
  'Base class style HttpModule is deprecated, use @HttpModuleClass decorator instead',
);
