import {Container} from 'inversify';
import * as http from 'http';
import {getHttpControllerMetadata} from './http-decorators';
import {promisify} from 'util';
import {KoaHttpApplicationBuilder} from './http-koa-integration';
import {HttpAdaptor, HttpApplicationOption, HttpInterceptor} from './http-abstract';
import lodash from 'lodash';
import {
  Constructor,
  createModule,
  Inject,
  ModuleClass,
  ModuleOption,
  ModuleScanner,
  OnModuleCreate,
  OnModuleDestroy,
  provideOptionInjector,
  ServiceIdentifier,
} from '@sensejs/core';

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
  httpAdaptorFactory?: () => HttpAdaptor;

  /**
   * Interceptors applied by this http server
   */
  globalInterceptors?: Constructor<HttpInterceptor>[];

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
   * @deprecated
   */
  matchLabel?: (string | symbol)[] | Set<string | symbol>;
  /**
   * If specified, only match the controllers which contains all required label
   */
  matchLabels?: (string | symbol)[] | Set<string | symbol>;
}

/**
 *
 * @param option
 * @constructor
 */
export function createHttpModule(option: HttpModuleOption = {httpOption: defaultHttpConfig}): Constructor {
  const httpAdaptorFactory = option.httpAdaptorFactory || (
    () => new KoaHttpApplicationBuilder()
  );
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

    constructor(
      @Inject(Container) private container: Container,
      @Inject(optionProvider.provide) private httpOption: HttpOption,
    ) {}

    @OnModuleCreate()
    async onCreate(@Inject(ModuleScanner) moduleScanner: ModuleScanner) {
      const httpAdaptor = httpAdaptorFactory();

      for (const inspector of option.globalInterceptors || []) {
        httpAdaptor.addGlobalInspector(inspector);
      }
      this.scanControllers(httpAdaptor, moduleScanner);

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
    }

    private scanControllers(
      httpAdaptor: HttpAdaptor,
      moduleScanner: ModuleScanner
    ) {
      const matchLabels = new Set<string | symbol>(option.matchLabels ?? option.matchLabel);
      moduleScanner.scanModule((metadata) => {
        metadata.components.forEach((component) => {
          const httpControllerMetadata = getHttpControllerMetadata(component);
          if (!httpControllerMetadata) {
            return;
          }
          const intersectedLabel = lodash.intersection([...matchLabels], [...httpControllerMetadata.labels]);
          if (intersectedLabel.length === matchLabels.size) {
            httpAdaptor.addControllerWithMetadata(httpControllerMetadata);
          }
        });
      });
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

  return HttpModule;
}
