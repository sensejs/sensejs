import {
  BodyParserOption,
  CrossOriginResourceShareOption,
  KoaHttpApplicationBuilder,
  QueryStringParsingMode,
} from './http-koa-integration.js';
import {
  Constructor,
  Inject,
  InjectLogger,
  Logger,
  Module,
  ModuleOption,
  provideOptionInjector,
  ServiceIdentifier,
} from '@sensejs/core';
import {AbstractHttpApplicationBuilder, AbstractHttpModule, HttpModuleOption, HttpOption} from '@sensejs/http-common';

export interface KoaHttpOption extends HttpOption {
  /**
   * Whether the http server trust `X-Forwarded-For` and `X-Forwarded-Proto` headers, default to `false`
   */
  trustProxy?: boolean;

  /**
   * Controlling how CORS requests are handled, by default CORS is disabled
   */
  corsOption?: CrossOriginResourceShareOption;

  queryStringParsingMode?: QueryStringParsingMode;

  bodyParserOption?: BodyParserOption;
}

export interface CreateKoaHttpModuleOption extends HttpModuleOption<KoaHttpOption>, ModuleOption {
  /**
   * If specified, httpOption will be overridden by value resolved by this service identifier
   */
  injectOptionFrom?: ServiceIdentifier<Partial<HttpOption>>;
}

/**
 *
 * @param option
 * @constructor
 */
export function createKoaHttpModule(option: CreateKoaHttpModuleOption = {}): Constructor {
  const {injectOptionFrom, factories, components, constants, requires, httpOption, ...rest} = option;
  const optionProvider = provideOptionInjector<KoaHttpOption>(
    httpOption,
    injectOptionFrom,
    (defaultValue, injectedValue) => {
      const {listenAddress, listenPort, ...rest} = Object.assign({}, defaultValue, injectedValue);
      if (typeof listenAddress !== 'string' || typeof listenPort !== 'number') {
        throw new Error('invalid http config');
      }
      return {listenAddress, listenPort, ...rest};
    },
  );

  @Module({
    factories: [optionProvider, ...(factories ?? [])],
    components,
    constants,
    requires,
  })
  class KoaHttpModule extends AbstractHttpModule {
    #logger;
    #httpOption;
    constructor(@InjectLogger() logger: Logger, @Inject(optionProvider.provide) httpOption: KoaHttpOption) {
      super({
        httpOption,
        ...rest,
      });
      this.#logger = logger;
      this.#httpOption = httpOption;
    }

    protected getAdaptor(): AbstractHttpApplicationBuilder {
      const builder = new KoaHttpApplicationBuilder().setErrorHandler((e) => {
        this.#logger.error('Error occurred when handling http request: ', e);
      });
      if (this.#httpOption.queryStringParsingMode) {
        builder.setQueryStringParsingMode(this.#httpOption.queryStringParsingMode);
      }
      if (typeof this.#httpOption.bodyParserOption !== 'undefined') {
        builder.setKoaBodyParserOption(this.#httpOption.bodyParserOption);
      }
      if (typeof this.#httpOption.corsOption !== 'undefined') {
        builder.setCorsOption(this.#httpOption.corsOption);
      }
      if (typeof this.#httpOption.trustProxy !== 'undefined') {
        builder.setTrustProxy(this.#httpOption.trustProxy);
      }
      return builder;
    }
  }

  return KoaHttpModule;
}
