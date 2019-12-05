import {inject} from 'inversify';
import {Client, ConfigOptions} from 'elasticsearch';
import {
  Module,
  ModuleConstructor,
  ModuleOption,
  provideConnectionFactory,
  provideOptionInjector,
  ServiceIdentifier,
} from '@sensejs/core';

export interface ElasticSearchModuleOptions extends ModuleOption {
  options: ConfigOptions;
  injectOptionFrom?: ServiceIdentifier<ConfigOptions>;
}

export function InjectElasticSearch() {
  return (target: any, key: string, index?: number) => {
    inject(Client)(target, key, index);
  };
}

export function ElasticSearchModule(options: ElasticSearchModuleOptions): ModuleConstructor {
  const factoryProvider = provideConnectionFactory(
    async (options: ConfigOptions) => new Client(options),
    async (client: Client) => Promise.resolve(client.close()),
    Client,
  );
  const optionProvider = provideOptionInjector(options.options, options.injectOptionFrom, (fallback, injected) => {
    return Object.assign({}, fallback, injected);
  });

  class ElasticSearchModule extends Module({
    requires: [Module(options)],
    factories: [factoryProvider, optionProvider],
  }) {
    constructor(
      @inject(factoryProvider.factory) private elasticClientFactory: InstanceType<typeof factoryProvider.factory>,
      @inject(optionProvider.provide) private elasticSearchOptions: ConfigOptions,
    ) {
      super();
    }

    async onCreate(): Promise<void> {
      await this.elasticClientFactory.connect(this.elasticSearchOptions);
    }

    async onDestroy(): Promise<void> {
      await this.elasticClientFactory.disconnect();
    }
  }

  return Module({requires: [ElasticSearchModule]});
}
