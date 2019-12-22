import Redis from 'ioredis';
import {
  createLegacyModule,
  createModule,
  Inject,
  ModuleClass,
  ModuleOption,
  Named,
  OnModuleCreate,
  OnModuleDestroy,
  provideConnectionFactory,
  provideOptionInjector,
  ServiceIdentifier,
  Constructor,
} from '@sensejs/core';

export interface RedisConnectOption extends Redis.RedisOptions {
  uri?: string;
}

export interface RedisModuleOptions extends ModuleOption {
  name?: string | symbol;
  options?: RedisConnectOption;
  injectOptionFrom?: ServiceIdentifier<RedisConnectOption>;
}

export function InjectRedis(name?: string | symbol) {
  return (target: any, key: string, index: number) => {
    Inject(Redis)(target, key, index);
    if (name) {
      Named(name)(target, key, index);
    }
  };
}

function checkRedisOptions(options: RedisModuleOptions[]) {
  const names: (string | symbol)[] = [];
  for (const option of options) {
    if (!option.name) {
      throw new Error('multi redis need `name` field');
    }

    if (names.includes(option.name)) {
      throw new Error('multi redis `name` duplicated');
    }

    names.push(option.name);
  }
}

/**
 * Create a module manage IORedis connection
 * @param options Option pass to IORedis constructor
 */
export function createRedisModule(options: RedisModuleOptions | RedisModuleOptions[]): Constructor {
  options = ([] as RedisModuleOptions[]).concat(options);

  if (options.length === 1) {
    return buildRedisModule(options[0]);
  }

  checkRedisOptions(options);

  return createModule({
    requires: options.map(buildRedisModule),
  });
}

/**
 * Create a base class style module
 * @deprecated
 * @see createRedisModule
 */
export const RedisModule = createLegacyModule(
  createRedisModule,
  'Base class style RedisModule is deprecated, use RedisModuleClass decorator instead.',
);

function createRedisConnection(options: RedisConnectOption) {
  return new Promise<Redis.Redis>((done, fail) => {
    const {uri, ...rest} = options;
    const redisClient = typeof uri === 'string' ? new Redis(uri, rest) : new Redis(rest);
    const errorHandlerBeforeConnect = (error: Error) => fail(error);
    redisClient.once('connect', () => {
      redisClient.removeListener('error', errorHandlerBeforeConnect);
      return done(redisClient);
    });
    redisClient.once('error', errorHandlerBeforeConnect);
  });
}

function destroyRedisConnection(connection: Redis.Redis) {
  return Promise.resolve(connection.disconnect());
}

function buildRedisModule(options: RedisModuleOptions): Constructor {
  const factoryProvider = provideConnectionFactory(createRedisConnection, destroyRedisConnection, Redis);
  const optionProvider = provideOptionInjector(options.options, options.injectOptionFrom, (fallback, injected) => {
    return Object.assign({}, fallback, injected);
  });
  Object.assign(factoryProvider, {name: options.name});

  @ModuleClass({
    requires: [createModule(options)],
    factories: [factoryProvider, optionProvider],
  })
  class RedisModule {
    constructor(
      @Inject(factoryProvider.factory) private redisClientFactory: InstanceType<typeof factoryProvider.factory>,
      @Inject(optionProvider.provide) private redisConnectOption: RedisConnectOption,
    ) {}

    @OnModuleCreate()
    async onCreate(): Promise<void> {
      await this.redisClientFactory.connect(this.redisConnectOption);
    }

    @OnModuleDestroy()
    async onDestroy(): Promise<void> {
      await this.redisClientFactory.disconnect();
    }
  }

  return RedisModule;
}
