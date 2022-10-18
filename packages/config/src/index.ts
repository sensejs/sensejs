import traverse from 'traverse';
import {Inject, Injectable, Scope} from '@sensejs/container';
import {ConstantProvider, Component, createModule} from '@sensejs/core';

export interface ConfigModuleOption {
  config: object;
  prefix: string;
}

function escape(x: string) {
  return x.replace(/\\/g, '\\\\').replace(/\./g, '\\.');
}

/**
 * @note It will be deprecated in next release end finally removed, use createStaticConfigModule instead
 */
export function createConfigModule(option: ConfigModuleOption) {
  function buildConfigMap(option: ConfigModuleOption): ConstantProvider[] {
    return traverse(option.config).reduce(function OptionsReducer(
      this: traverse.TraverseContext,
      acc: ConstantProvider[],
      value: unknown,
    ) {
      if (this.circular) {
        throw new Error('circular detected');
      }
      acc.push({
        provide: [option.prefix].concat(this.path).map(escape).join('.'),
        value,
      });
      return acc;
    },
    []);
  }
  const constants = buildConfigMap(option);
  return createModule({constants});
}

@Injectable()
export abstract class ConfigProvider {
  abstract get(configKey: string): unknown;
}

export interface InjectConfigOption {
  transform?: (x: unknown) => unknown;
  optional?: boolean;
}

export class MissingConfigError extends Error {
  constructor(readonly configKey: string) {
    super();
    Error.captureStackTrace(this, MissingConfigError);
  }
}

export function Config(configKey: string, options: InjectConfigOption = {}) {
  const {transform = (x) => x, optional = false} = options;

  return Inject(ConfigProvider, {
    transform: (x: ConfigProvider) => {
      const result = x.get(configKey);
      if (typeof result === 'undefined' && !optional) {
        throw new MissingConfigError(configKey);
      }
      return transform(result);
    },
  });
}

export function createStaticConfigModule(config: object) {
  @Component()
  @Scope(Scope.SINGLETON)
  class StaticConfigProvider extends ConfigProvider {
    private configMap: Map<string, any> = traverse(config).reduce(function OptionsReducer(
      this: traverse.TraverseContext,
      map: Map<string, any>,
      value: any,
    ) {
      if (this.circular) {
        throw new Error('circular detected');
      }
      const key = this.path.map(escape).join('.');
      map.set(key, value);
      return map;
    },
    new Map());
    get(configKey: string): unknown {
      return this.configMap.get(configKey);
    }
  }

  return createModule({components: [StaticConfigProvider]});
}
