import {AsyncInterceptProvider, Container} from '@sensejs/container';
import * as http from 'http';
import {promisify} from 'util';
import {KoaHttpApplicationBuilder} from './http-koa-integration.js';
import {
  Constructor,
  createModule,
  DynamicModuleLoader,
  Inject,
  InjectLogger,
  Logger,
  matchLabels,
  ModuleClass,
  ModuleOption,
  ModuleScanner,
  OnModuleCreate,
  OnStart,
  OnStop,
  provideOptionInjector,
  ServiceIdentifier,
} from '@sensejs/core';
import {getHttpControllerMetadata, HttpApplicationOption} from '@sensejs/http-common';

export interface HttpOption extends HttpApplicationOption {
  listenAddress: string;
  listenPort: number;
  trustProxy?: boolean;
}

const defaultHttpConfig = {
  listenAddress: '0.0.0.0',
  listenPort: 3000,
};

export interface HttpModuleOption extends ModuleOption {
  /**
   *
   */
  httpAdaptorFactory?: () => KoaHttpApplicationBuilder;

  /**
   * Intercept providers applied by this http server
   */
  globalInterceptProviders?: Constructor<AsyncInterceptProvider>[];

  /**
   * If specified, http server instance will be bound to container with this as service identifier
   */
  serverIdentifier?: ServiceIdentifier;

  /**
   * Http application options
   */
  httpOption?: Partial<HttpOption>;

  /**
   * If specified, httpOption will be overridden by value resolved by this service identifier
   */
  injectOptionFrom?: ServiceIdentifier<Partial<HttpOption>>;

  /**
   * If specified, only match the controllers which contains all required label
   */
  matchLabels?: (string | symbol)[] | Set<string | symbol> | ((labels: Set<string | symbol>) => boolean);
}

/**
 *
 * @param option
 * @constructor
 */
export function createHttpModule(option: HttpModuleOption = {httpOption: defaultHttpConfig}): Constructor {
  const serverIdentifier = option.serverIdentifier ?? Symbol();
  const httpAdaptorFactory = option.httpAdaptorFactory || (() => new KoaHttpApplicationBuilder());
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
    constructor(
      @InjectLogger() private logger: Logger,
      @Inject(Container) private container: Container,
      @Inject(optionProvider.provide) private httpOption: HttpOption,
    ) {}

    @OnModuleCreate()
    async onCreate(@Inject(DynamicModuleLoader) loader: DynamicModuleLoader) {
      loader.addConstant({
        provide: serverIdentifier,
        value: http.createServer(),
      });
    }

    @OnStart()
    async onStart(
      @Inject(ModuleScanner) moduleScanner: ModuleScanner,
      @Inject(serverIdentifier) httpServer: http.Server,
    ) {
      const httpAdaptor = httpAdaptorFactory().setErrorHandler((e) => {
        this.logger.error('Error occurred when handling http request: ', e);
      });

      for (const ip of option.globalInterceptProviders || []) {
        httpAdaptor.addGlobalInterceptProvider(ip);
      }
      this.scanControllers(httpAdaptor, moduleScanner);

      await this.setupHttpServer(this.httpOption, httpAdaptor, httpServer);
    }

    @OnStop()
    async onStop(@Inject(serverIdentifier) httpServer: http.Server) {
      if (httpServer.listening) {
        await promisify((done: (e?: Error) => void) => {
          return httpServer.close(done);
        })();
      }
    }

    private scanControllers(httpAdaptor: KoaHttpApplicationBuilder, moduleScanner: ModuleScanner) {
      moduleScanner.scanModule((metadata) => {
        metadata.components.forEach((component) => {
          const httpControllerMetadata = getHttpControllerMetadata(component);
          if (!httpControllerMetadata) {
            return;
          }
          if (!matchLabels(httpControllerMetadata.labels, option.matchLabels)) {
            return;
          }
          httpAdaptor.addControllerWithMetadata(httpControllerMetadata);
        });
      });
    }

    private setupHttpServer(httpOption: HttpOption, httpAdaptor: KoaHttpApplicationBuilder, httpServer: http.Server) {
      const {listenPort, listenAddress, ...httpApplicationOption} = httpOption;
      return new Promise<http.Server>((resolve, reject) => {
        httpServer.on('request', httpAdaptor.build(httpApplicationOption, this.container));
        httpServer.once('error', reject);
        httpServer.listen(listenPort, listenAddress, () => {
          httpServer.removeListener('error', reject);
          resolve(httpServer);
        });
      });
    }
  }

  return HttpModule;
}
